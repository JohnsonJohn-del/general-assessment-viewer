import os
import sys
import json
import sqlite3
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler
import uuid

# Ensure UTF-8 output
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'data', 'evaluation.db')
PORT = 8088

# Load candidate metadata and question list from assessment.json
ASSESSMENT_JSON_PATH = os.path.join(BASE_DIR, 'data', 'assessment.json')
CANDIDATE_MAP = {}
TOTAL_QUESTIONS = 28
QUESTIONS_LIST = []

if os.path.exists(ASSESSMENT_JSON_PATH):
    try:
        with open(ASSESSMENT_JSON_PATH, 'r', encoding='utf-8') as f:
            adata = json.load(f)
            TOTAL_QUESTIONS = len(adata.get('questions', []))
            QUESTIONS_LIST = adata.get('questions', [])
            for r in adata.get('respondents', []):
                cid = r['id']
                CANDIDATE_MAP[cid] = {
                    'id': cid,
                    'code': f"GA-{cid:03d}",
                    'name': r['name'],
                    'division': r['division']
                }
    except Exception as e:
        print(f"Warning loading assessment.json: {e}")

def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db():
    os.makedirs(os.path.join(BASE_DIR, 'data'), exist_ok=True)
    conn = get_db()
    cursor = conn.cursor()

    # Drop legacy tables (Voting and legacy global candidate tables)
    cursor.execute("DROP TABLE IF EXISTS votes")
    cursor.execute("DROP TABLE IF EXISTS opinions")
    cursor.execute("DROP TABLE IF EXISTS ratings")

    # 1. Participants table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS participants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        student_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. Candidate Classifications (Good Candidate / Has Potential / Rejected)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS candidate_classifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        participant_id TEXT NOT NULL,
        candidate_id INTEGER NOT NULL,
        classification TEXT NOT NULL CHECK(classification IN ('good_candidate', 'has_potential', 'rejected')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(participant_id, candidate_id),
        FOREIGN KEY(participant_id) REFERENCES participants(id) ON DELETE CASCADE
    );
    """)

    # 3. Individual Answer Evaluations (Per candidate & question: opinion + 1-5 star rating)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS answer_evaluations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        participant_id TEXT NOT NULL,
        candidate_id INTEGER NOT NULL,
        question_id INTEGER NOT NULL,
        opinion TEXT CHECK(opinion IN ('agree', 'disagree')),
        rating INTEGER CHECK(rating >= 1 AND rating <= 5),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(participant_id, candidate_id, question_id),
        FOREIGN KEY(participant_id) REFERENCES participants(id) ON DELETE CASCADE
    );
    """)

    # Migrate from old classifications table if it existed
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='classifications'")
    if cursor.fetchone():
        try:
            cursor.execute("""
            INSERT OR IGNORE INTO candidate_classifications (participant_id, candidate_id, classification, created_at, updated_at)
            SELECT participant_id, candidate_id, classification, created_at, updated_at FROM classifications
            """)
            cursor.execute("DROP TABLE classifications")
        except Exception as e:
            print("Migration note:", e)

    conn.commit()
    conn.close()
    print("[OK] SQLite Database initialized with answer_evaluations and candidate_classifications at", DB_PATH)

init_db()

class AssessmentRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def log_message(self, format, *args):
        try:
            msg = format % args if args else str(format)
        except Exception:
            msg = str(format)
        if '/api/' in msg:
            sys.stdout.write(f"API: {msg}\n")
            sys.stdout.flush()

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path == '/api/participant/profile':
            self.handle_get_profile(query)
            return

        if path in ['/api/overview', '/api/evaluation/overview']:
            self.handle_get_overview(query)
            return

        if path.startswith('/api/candidate/') or path.startswith('/api/evaluation/candidate/'):
            try:
                candidate_id = int(path.rstrip('/').split('/')[-1])
                self.handle_get_candidate(candidate_id, query)
                return
            except ValueError:
                self.send_json({'error': 'Invalid candidate ID'}, 400)
                return

        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)

        try:
            body = json.loads(post_data.decode('utf-8')) if post_data else {}
        except Exception:
            self.send_json({'error': 'Invalid JSON body'}, 400)
            return

        if path == '/api/participant/register':
            self.handle_register_participant(body)
            return

        if path == '/api/candidate/classify':
            self.handle_candidate_classify(body)
            return

        if path == '/api/answer/evaluate':
            self.handle_answer_evaluate(body)
            return

        self.send_json({'error': 'Endpoint not found'}, 404)

    # ---------------- API HANDLERS ---------------- #

    def handle_register_participant(self, body):
        name = str(body.get('name', '')).strip()
        student_id = str(body.get('student_id', '')).strip() if body.get('student_id') else None

        if not name:
            self.send_json({'error': 'Name is required'}, 400)
            return

        if len(name) > 80:
            name = name[:80]
        if student_id and len(student_id) > 40:
            student_id = student_id[:40]

        conn = get_db()
        cursor = conn.cursor()

        if student_id:
            cursor.execute(
                "SELECT id, name, student_id FROM participants WHERE LOWER(name) = LOWER(?) AND LOWER(student_id) = LOWER(?) LIMIT 1",
                (name, student_id)
            )
        else:
            cursor.execute(
                "SELECT id, name, student_id FROM participants WHERE LOWER(name) = LOWER(?) LIMIT 1",
                (name,)
            )

        row = cursor.fetchone()
        if row:
            p_id = row['id']
            cursor.execute(
                "UPDATE participants SET last_seen = CURRENT_TIMESTAMP WHERE id = ?",
                (p_id,)
            )
            conn.commit()
            p_name = row['name']
            p_sid = row['student_id']
        else:
            p_id = f"p_{uuid.uuid4().hex[:10]}"
            cursor.execute(
                "INSERT INTO participants (id, name, student_id) VALUES (?, ?, ?)",
                (p_id, name, student_id)
            )
            conn.commit()
            p_name = name
            p_sid = student_id

        # Fetch their existing classifications & evaluations count
        cursor.execute("SELECT candidate_id, classification FROM candidate_classifications WHERE participant_id = ?", (p_id,))
        classifications = {r['candidate_id']: r['classification'] for r in cursor.fetchall()}

        cursor.execute("SELECT COUNT(*) as total FROM answer_evaluations WHERE participant_id = ?", (p_id,))
        answers_count = cursor.fetchone()['total'] or 0

        conn.close()

        self.send_json({
            'success': True,
            'participant': {
                'id': p_id,
                'name': p_name,
                'student_id': p_sid
            },
            'activity': {
                'classifications': classifications,
                'total_answers_evaluated': answers_count
            }
        })

    def handle_get_profile(self, query):
        p_id = query.get('participant_id', [None])[0]
        if not p_id:
            self.send_json({'error': 'participant_id required'}, 400)
            return

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, student_id, created_at, last_seen FROM participants WHERE id = ?", (p_id,))
        p = cursor.fetchone()
        if not p:
            conn.close()
            self.send_json({'error': 'Participant not found'}, 404)
            return

        cursor.execute("SELECT candidate_id, classification, updated_at FROM candidate_classifications WHERE participant_id = ?", (p_id,))
        classifications = {r['candidate_id']: {'classification': r['classification'], 'updated_at': r['updated_at']} for r in cursor.fetchall()}

        cursor.execute("SELECT candidate_id, question_id, opinion, rating, updated_at FROM answer_evaluations WHERE participant_id = ?", (p_id,))
        answer_rows = cursor.fetchall()
        evaluations_by_candidate = {}
        for ar in answer_rows:
            cid = ar['candidate_id']
            if cid not in evaluations_by_candidate:
                evaluations_by_candidate[cid] = []
            evaluations_by_candidate[cid].append({
                'question_id': ar['question_id'],
                'opinion': ar['opinion'],
                'rating': ar['rating'],
                'updated_at': ar['updated_at']
            })

        conn.close()

        self.send_json({
            'participant': dict(p),
            'classifications': classifications,
            'evaluations': evaluations_by_candidate
        })

    def handle_candidate_classify(self, body):
        p_id = body.get('participant_id')
        candidate_id = body.get('candidate_id')
        classification = body.get('classification')  # 'good_candidate', 'has_potential', 'rejected', or None / 'clear'

        if not p_id:
            self.send_json({'error': 'participant_id is required. Please identify yourself first.'}, 401)
            return

        if not candidate_id or candidate_id not in CANDIDATE_MAP:
            self.send_json({'error': 'Invalid candidate_id'}, 400)
            return

        conn = get_db()
        cursor = conn.cursor()

        cursor.execute("SELECT id, name, student_id FROM participants WHERE id = ?", (p_id,))
        p = cursor.fetchone()
        if not p:
            conn.close()
            self.send_json({'error': 'Participant not found. Please re-enter your name.'}, 401)
            return

        if classification in ['good_candidate', 'has_potential', 'rejected']:
            cursor.execute("""
                INSERT INTO candidate_classifications (participant_id, candidate_id, classification, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(participant_id, candidate_id) DO UPDATE SET
                    classification = excluded.classification,
                    updated_at = CURRENT_TIMESTAMP
            """, (p_id, candidate_id, classification))
        elif classification is None or classification == '' or classification == 'clear':
            cursor.execute("DELETE FROM candidate_classifications WHERE participant_id = ? AND candidate_id = ?", (p_id, candidate_id))
        else:
            conn.close()
            self.send_json({'error': 'Invalid classification value'}, 400)
            return

        cursor.execute("UPDATE participants SET last_seen = CURRENT_TIMESTAMP WHERE id = ?", (p_id,))
        conn.commit()

        candidate_data = self._get_candidate_data(cursor, candidate_id, p_id)
        conn.close()

        self.send_json({
            'success': True,
            'message': 'Candidate status updated.',
            'candidate_data': candidate_data
        })

    def handle_answer_evaluate(self, body):
        p_id = body.get('participant_id')
        candidate_id = body.get('candidate_id')
        question_id = body.get('question_id')
        opinion = body.get('opinion')   # 'agree', 'disagree', or None / 'clear'
        rating = body.get('rating')     # 1..5, or None / 0

        if not p_id:
            self.send_json({'error': 'participant_id is required. Please identify yourself first.'}, 401)
            return

        if not candidate_id or candidate_id not in CANDIDATE_MAP:
            self.send_json({'error': 'Invalid candidate_id'}, 400)
            return

        if not question_id or not (1 <= int(question_id) <= TOTAL_QUESTIONS):
            self.send_json({'error': 'Invalid question_id'}, 400)
            return

        question_id = int(question_id)

        # Validate rating if provided
        validated_rating = None
        if rating is not None and rating != '' and rating != 0:
            try:
                r_int = int(rating)
                if 1 <= r_int <= 5:
                    validated_rating = r_int
                else:
                    self.send_json({'error': 'Rating must be between 1 and 5 stars'}, 400)
                    return
            except ValueError:
                self.send_json({'error': 'Invalid rating number'}, 400)
                return

        # Validate opinion if provided
        validated_opinion = None
        if opinion in ['agree', 'disagree']:
            validated_opinion = opinion
        elif opinion in [None, '', 'clear']:
            validated_opinion = None

        conn = get_db()
        cursor = conn.cursor()

        cursor.execute("SELECT id, name, student_id FROM participants WHERE id = ?", (p_id,))
        p = cursor.fetchone()
        if not p:
            conn.close()
            self.send_json({'error': 'Participant not found. Please re-enter your name.'}, 401)
            return

        # Check existing record for this answer
        cursor.execute("""
            SELECT id, opinion, rating FROM answer_evaluations
            WHERE participant_id = ? AND candidate_id = ? AND question_id = ?
        """, (p_id, candidate_id, question_id))
        existing = cursor.fetchone()

        if existing:
            # Determine new values
            # If explicit param passed, use it, else keep existing
            new_opinion = validated_opinion if opinion is not None else existing['opinion']
            new_rating = validated_rating if rating is not None else existing['rating']

            if new_opinion is None and new_rating is None:
                cursor.execute("DELETE FROM answer_evaluations WHERE id = ?", (existing['id'],))
            else:
                cursor.execute("""
                    UPDATE answer_evaluations
                    SET opinion = ?, rating = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                """, (new_opinion, new_rating, existing['id']))
        else:
            if validated_opinion is not None or validated_rating is not None:
                cursor.execute("""
                    INSERT INTO answer_evaluations (participant_id, candidate_id, question_id, opinion, rating, updated_at)
                    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """, (p_id, candidate_id, question_id, validated_opinion, validated_rating))

        cursor.execute("UPDATE participants SET last_seen = CURRENT_TIMESTAMP WHERE id = ?", (p_id,))
        conn.commit()

        candidate_data = self._get_candidate_data(cursor, candidate_id, p_id)
        conn.close()

        self.send_json({
            'success': True,
            'message': 'Answer evaluation recorded.',
            'candidate_data': candidate_data
        })

    def handle_get_candidate(self, candidate_id, query):
        if candidate_id not in CANDIDATE_MAP:
            self.send_json({'error': 'Candidate not found'}, 404)
            return

        p_id = query.get('participant_id', [None])[0]
        conn = get_db()
        cursor = conn.cursor()
        data = self._get_candidate_data(cursor, candidate_id, p_id)
        conn.close()
        self.send_json(data)

    def _get_candidate_data(self, cursor, candidate_id, p_id=None):
        candidate_info = CANDIDATE_MAP.get(candidate_id, {})

        # 1. Candidate Classifications
        cursor.execute("""
            SELECT p.id as participant_id, p.name, p.student_id, c.classification, c.updated_at
            FROM candidate_classifications c
            JOIN participants p ON c.participant_id = p.id
            WHERE c.candidate_id = ?
            ORDER BY c.updated_at DESC
        """, (candidate_id,))
        all_cls = cursor.fetchall()

        good_voters = [dict(r) for r in all_cls if r['classification'] == 'good_candidate']
        potential_voters = [dict(r) for r in all_cls if r['classification'] == 'has_potential']
        rejected_voters = [dict(r) for r in all_cls if r['classification'] == 'rejected']
        total_cls = len(all_cls)

        good_pct = round((len(good_voters) / total_cls * 100), 1) if total_cls > 0 else 0
        potential_pct = round((len(potential_voters) / total_cls * 100), 1) if total_cls > 0 else 0
        rejected_pct = round((len(rejected_voters) / total_cls * 100), 1) if total_cls > 0 else 0

        # Current participant's classification
        my_classification = None
        if p_id:
            cursor.execute("""
                SELECT classification FROM candidate_classifications
                WHERE participant_id = ? AND candidate_id = ?
            """, (p_id, candidate_id))
            mc = cursor.fetchone()
            if mc:
                my_classification = mc['classification']

        # 2. General Assessment Overall Score (Section 9)
        # Formula: General Assessment Score = (Average General Assessment Rating / 5) * 100
        cursor.execute("""
            SELECT AVG(rating) as avg_rating, COUNT(rating) as total_ratings, COUNT(DISTINCT question_id) as rated_answers
            FROM answer_evaluations
            WHERE candidate_id = ? AND rating IS NOT NULL
        """, (candidate_id,))
        score_row = cursor.fetchone()
        overall_avg_rating = round(score_row['avg_rating'], 2) if score_row['avg_rating'] is not None else None
        total_ratings_count = score_row['total_ratings'] or 0
        rated_answers_count = score_row['rated_answers'] or 0

        if overall_avg_rating is not None:
            general_assessment_score = round((overall_avg_rating / 5.0) * 100.0, 1)
        else:
            general_assessment_score = None

        # 3. Personal Evaluation metrics for current evaluator (Section 9)
        personal_stats = {
            'answers_evaluated': 0,
            'answers_rated': 0,
            'avg_rating': None,
            'score': None,
            'agree_count': 0,
            'disagree_count': 0
        }
        if p_id:
            cursor.execute("""
                SELECT 
                    COUNT(*) as evaluated_count,
                    COUNT(rating) as rated_count,
                    AVG(rating) as personal_avg,
                    SUM(CASE WHEN opinion = 'agree' THEN 1 ELSE 0 END) as agrees,
                    SUM(CASE WHEN opinion = 'disagree' THEN 1 ELSE 0 END) as disagrees
                FROM answer_evaluations
                WHERE candidate_id = ? AND participant_id = ?
            """, (candidate_id, p_id))
            p_stat_row = cursor.fetchone()
            if p_stat_row:
                personal_stats['answers_evaluated'] = p_stat_row['evaluated_count'] or 0
                personal_stats['answers_rated'] = p_stat_row['rated_count'] or 0
                if p_stat_row['personal_avg'] is not None:
                    p_avg = round(p_stat_row['personal_avg'], 2)
                    personal_stats['avg_rating'] = p_avg
                    personal_stats['score'] = round((p_avg / 5.0) * 100.0, 1)
                personal_stats['agree_count'] = p_stat_row['agrees'] or 0
                personal_stats['disagree_count'] = p_stat_row['disagree_count'] if 'disagree_count' in p_stat_row.keys() else (p_stat_row['disagrees'] or 0)

        # 4. Answer-Level Evaluations for each Question (1 to 28)
        cursor.execute("""
            SELECT 
                ae.id,
                ae.question_id,
                ae.participant_id,
                p.name as evaluator_name,
                p.student_id as evaluator_student_id,
                ae.opinion,
                ae.rating,
                ae.updated_at
            FROM answer_evaluations ae
            JOIN participants p ON ae.participant_id = p.id
            WHERE ae.candidate_id = ?
            ORDER BY ae.question_id ASC, ae.updated_at DESC
        """, (candidate_id,))
        all_answers_raw = cursor.fetchall()

        answers_map = {}
        for q_num in range(1, TOTAL_QUESTIONS + 1):
            answers_map[q_num] = {
                'question_id': q_num,
                'avg_rating': None,
                'total_ratings': 0,
                'distribution': {5: 0, 4: 0, 3: 0, 2: 0, 1: 0},
                'agree_count': 0,
                'disagree_count': 0,
                'total_evaluators': 0,
                'evaluators': [],
                'my_evaluation': {'opinion': None, 'rating': None}
            }

        for ar in all_answers_raw:
            qid = ar['question_id']
            if qid not in answers_map:
                continue

            entry = answers_map[qid]
            ev_data = {
                'participant_id': ar['participant_id'],
                'name': ar['evaluator_name'],
                'student_id': ar['evaluator_student_id'],
                'opinion': ar['opinion'],
                'rating': ar['rating'],
                'updated_at': ar['updated_at']
            }
            entry['evaluators'].append(ev_data)
            entry['total_evaluators'] += 1

            if ar['opinion'] == 'agree':
                entry['agree_count'] += 1
            elif ar['opinion'] == 'disagree':
                entry['disagree_count'] += 1

            if ar['rating'] is not None and 1 <= ar['rating'] <= 5:
                entry['total_ratings'] += 1
                entry['distribution'][ar['rating']] += 1

            if p_id and ar['participant_id'] == p_id:
                entry['my_evaluation'] = {
                    'opinion': ar['opinion'],
                    'rating': ar['rating']
                }

        # Calculate avg rating for each question
        candidate_report_rows = []
        for q_num in range(1, TOTAL_QUESTIONS + 1):
            ans_info = answers_map[q_num]
            if ans_info['total_ratings'] > 0:
                weighted_sum = sum(star * count for star, count in ans_info['distribution'].items())
                ans_info['avg_rating'] = round(weighted_sum / ans_info['total_ratings'], 2)
            else:
                ans_info['avg_rating'] = None

            candidate_report_rows.append({
                'question_id': q_num,
                'avg_rating': ans_info['avg_rating'],
                'total_ratings': ans_info['total_ratings'],
                'agree_count': ans_info['agree_count'],
                'disagree_count': ans_info['disagree_count']
            })

        # 5. Individual Evaluator Reports for this candidate (Section 10)
        # Evaluators who classified or evaluated at least one answer for this candidate
        cursor.execute("""
            SELECT DISTINCT p.id, p.name, p.student_id
            FROM participants p
            LEFT JOIN candidate_classifications c ON c.participant_id = p.id AND c.candidate_id = ?
            LEFT JOIN answer_evaluations ae ON ae.participant_id = p.id AND ae.candidate_id = ?
            WHERE c.candidate_id = ? OR ae.candidate_id = ?
            ORDER BY p.name ASC
        """, (candidate_id, candidate_id, candidate_id, candidate_id))
        candidate_evaluators = cursor.fetchall()

        individual_reports = []
        for ev in candidate_evaluators:
            ev_id = ev['id']
            # classification
            cursor.execute("SELECT classification FROM candidate_classifications WHERE participant_id = ? AND candidate_id = ?", (ev_id, candidate_id))
            c_row = cursor.fetchone()
            ev_cls = c_row['classification'] if c_row else None

            # answer evals
            cursor.execute("""
                SELECT question_id, opinion, rating, updated_at
                FROM answer_evaluations
                WHERE participant_id = ? AND candidate_id = ?
            """, (ev_id, candidate_id))
            ev_ans_rows = cursor.fetchall()

            ev_ans_map = {}
            ev_agrees = 0
            ev_disagrees = 0
            ev_ratings_list = []

            for row in ev_ans_rows:
                qid = row['question_id']
                ev_ans_map[qid] = {
                    'opinion': row['opinion'],
                    'rating': row['rating']
                }
                if row['opinion'] == 'agree':
                    ev_agrees += 1
                elif row['opinion'] == 'disagree':
                    ev_disagrees += 1
                if row['rating'] is not None:
                    ev_ratings_list.append(row['rating'])

            ev_avg = round(sum(ev_ratings_list) / len(ev_ratings_list), 2) if ev_ratings_list else None
            ev_score = round((ev_avg / 5.0) * 100.0, 1) if ev_avg is not None else None

            individual_reports.append({
                'participant_id': ev_id,
                'name': ev['name'],
                'student_id': ev['student_id'],
                'classification': ev_cls,
                'answers_evaluated': len(ev_ans_rows),
                'total_questions': TOTAL_QUESTIONS,
                'agree_count': ev_agrees,
                'disagree_count': ev_disagrees,
                'avg_rating': ev_avg,
                'general_assessment_score': ev_score,
                'evaluations': ev_ans_map
            })

        return {
            'candidate_id': candidate_id,
            'candidate_info': candidate_info,
            'classifications': {
                'total': total_cls,
                'good_count': len(good_voters),
                'good_percentage': good_pct,
                'good_voters': good_voters,
                'potential_count': len(potential_voters),
                'potential_percentage': potential_pct,
                'potential_voters': potential_voters,
                'rejected_count': len(rejected_voters),
                'rejected_percentage': rejected_pct,
                'rejected_voters': rejected_voters,
                'my_classification': my_classification
            },
            'score_overview': {
                'general_assessment': {
                    'score': general_assessment_score,
                    'average_rating': overall_avg_rating,
                    'total_ratings': total_ratings_count,
                    'rated_answers_count': rated_answers_count,
                    'total_questions': TOTAL_QUESTIONS
                },
                'technical_assessment': {
                    'score': None, # '-- / 100'
                    'label': '-- / 100',
                    'note': 'Separate assessment'
                },
                'personal_evaluation': personal_stats
            },
            'answers': answers_map,
            'candidate_report': {
                'classification_summary': {
                    'good_count': len(good_voters),
                    'good_percentage': good_pct,
                    'potential_count': len(potential_voters),
                    'potential_percentage': potential_pct,
                    'rejected_count': len(rejected_voters),
                    'rejected_percentage': rejected_pct
                },
                'overall_avg_rating': overall_avg_rating,
                'general_assessment_score': general_assessment_score,
                'questions': candidate_report_rows
            },
            'individual_evaluator_reports': individual_reports
        }

    def handle_get_overview(self, query):
        conn = get_db()
        cursor = conn.cursor()

        # Participation Metrics
        cursor.execute("SELECT COUNT(*) as total FROM participants")
        total_participants = cursor.fetchone()['total'] or 0

        cursor.execute("SELECT COUNT(DISTINCT participant_id) as total FROM candidate_classifications")
        classifying_participants = cursor.fetchone()['total'] or 0

        cursor.execute("SELECT COUNT(DISTINCT participant_id) as total FROM answer_evaluations")
        evaluating_participants = cursor.fetchone()['total'] or 0

        cursor.execute("SELECT COUNT(*) as total FROM answer_evaluations")
        total_answer_evaluations = cursor.fetchone()['total'] or 0

        cursor.execute("SELECT COUNT(*) as total FROM answer_evaluations WHERE rating IS NOT NULL")
        total_star_ratings = cursor.fetchone()['total'] or 0

        cursor.execute("SELECT COUNT(*) as total FROM answer_evaluations WHERE opinion = 'agree'")
        total_agrees = cursor.fetchone()['total'] or 0

        cursor.execute("SELECT COUNT(*) as total FROM answer_evaluations WHERE opinion = 'disagree'")
        total_disagrees = cursor.fetchone()['total'] or 0

        # Overall Candidate Overview Table (Section 12 & 13)
        candidates_overview = []
        for cid in sorted(CANDIDATE_MAP.keys()):
            cinfo = CANDIDATE_MAP[cid]

            # Classifications
            cursor.execute("""
                SELECT classification, COUNT(*) as cnt 
                FROM candidate_classifications 
                WHERE candidate_id = ? 
                GROUP BY classification
            """, (cid,))
            c_counts = {r['classification']: r['cnt'] for r in cursor.fetchall()}
            good_c = c_counts.get('good_candidate', 0)
            pot_c = c_counts.get('has_potential', 0)
            rej_c = c_counts.get('rejected', 0)
            tot_cls = good_c + pot_c + rej_c

            good_pct = round((good_c / tot_cls * 100), 1) if tot_cls > 0 else 0
            pot_pct = round((pot_c / tot_cls * 100), 1) if tot_cls > 0 else 0
            rej_pct = round((rej_c / tot_cls * 100), 1) if tot_cls > 0 else 0

            # Answer Ratings & Score (0-100)
            cursor.execute("""
                SELECT AVG(rating) as avg_r, COUNT(rating) as count_r,
                       SUM(CASE WHEN opinion = 'agree' THEN 1 ELSE 0 END) as agrees,
                       SUM(CASE WHEN opinion = 'disagree' THEN 1 ELSE 0 END) as disagrees
                FROM answer_evaluations
                WHERE candidate_id = ?
            """, (cid,))
            ans_stat = cursor.fetchone()
            avg_r = round(ans_stat['avg_r'], 2) if ans_stat and ans_stat['avg_r'] is not None else None
            cnt_r = ans_stat['count_r'] if ans_stat else 0
            agrees = ans_stat['agrees'] if ans_stat and ans_stat['agrees'] is not None else 0
            disagrees = ans_stat['disagrees'] if ans_stat and ans_stat['disagrees'] is not None else 0

            ga_score = round((avg_r / 5.0) * 100.0, 1) if avg_r is not None else None

            candidates_overview.append({
                'candidate_id': cid,
                'code': cinfo['code'],
                'name': cinfo['name'],
                'division': cinfo['division'],
                'good_candidate': good_c,
                'good_percentage': good_pct,
                'has_potential': pot_c,
                'potential_percentage': pot_pct,
                'rejected': rej_c,
                'rejected_percentage': rej_pct,
                'total_classifications': tot_cls,
                'general_assessment_score': ga_score,
                'avg_rating': avg_r,
                'total_ratings': cnt_r,
                'total_agrees': agrees,
                'total_disagrees': disagrees
            })

        # Global Evaluators Ledger
        cursor.execute("""
            SELECT 
                p.id,
                p.name,
                p.student_id,
                p.last_seen,
                (SELECT COUNT(*) FROM candidate_classifications WHERE participant_id = p.id) as candidates_classified,
                (SELECT COUNT(*) FROM answer_evaluations WHERE participant_id = p.id) as answers_evaluated,
                (SELECT AVG(rating) FROM answer_evaluations WHERE participant_id = p.id AND rating IS NOT NULL) as avg_rating_given
            FROM participants p
            ORDER BY p.last_seen DESC
        """)
        evaluators_ledger = []
        for pr in cursor.fetchall():
            avg_rg = round(pr['avg_rating_given'], 2) if pr['avg_rating_given'] is not None else None
            evaluators_ledger.append({
                'id': pr['id'],
                'name': pr['name'],
                'student_id': pr['student_id'],
                'last_seen': pr['last_seen'],
                'candidates_classified': pr['candidates_classified'] or 0,
                'answers_evaluated': pr['answers_evaluated'] or 0,
                'avg_rating_given': avg_rg
            })

        conn.close()

        self.send_json({
            'participation': {
                'total_evaluators': total_participants,
                'classifying_evaluators': classifying_participants,
                'evaluating_participants': evaluating_participants,
                'total_answer_evaluations': total_answer_evaluations,
                'total_star_ratings': total_star_ratings,
                'total_agrees': total_agrees,
                'total_disagrees': total_disagrees
            },
            'candidates_overview': candidates_overview,
            'evaluators_ledger': evaluators_ledger
        })

def run():
    server = HTTPServer(('127.0.0.1', PORT), AssessmentRequestHandler)
    print(f"General Assessment Server listening on http://127.0.0.1:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        server.server_close()

if __name__ == '__main__':
    run()
