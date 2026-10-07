import os
import sys
import openpyxl
import json

# Ensure stdout handles UTF-8
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

base_dir = os.path.dirname(os.path.abspath(__file__))
xlsx_path = os.path.join(base_dir, 'General Assessment(1-31).xlsx')

if not os.path.exists(xlsx_path):
    print(f"Error: {xlsx_path} not found.")
    sys.exit(1)

wb = openpyxl.load_workbook(xlsx_path, data_only=True)
ws = wb['Sheet1']
rows = list(ws.iter_rows(values_only=True))

headers = rows[0]
records = rows[1:]

# Detect question columns logically
# Metadata columns:
# ID, Start time, Completion time, Email, Name, Total points, Quiz feedback,
# Last modified time, Full Name, Points - Full Name, Feedback - Full Name,
# Division / Class, Points - Division / Class, Feedback - Division / Class
questions = []
i = 14
while i < len(headers):
    h = headers[i]
    if not h:
        i += 1
        continue
    h_strip = h.strip()
    if not h_strip.startswith('Points - ') and not h_strip.startswith('Feedback - '):
        q_idx = i
        p_idx = None
        f_idx = None
        for j in range(i + 1, min(i + 5, len(headers))):
            jh = headers[j]
            if not jh:
                continue
            jh_strip = jh.strip()
            if jh_strip.startswith('Points - '):
                p_idx = j
            elif jh_strip.startswith('Feedback - '):
                f_idx = j
        
        q_num = len(questions) + 1
        section_id = 'A' if q_num <= 12 else 'B'
        section_title = 'Section A: Leadership & Situational Assessment' if q_num <= 12 else 'Section B: Technical & Computing Assessment'
        
        questions.append({
            'q_num': q_num,
            'header': h,
            'col_q': q_idx,
            'col_p': p_idx,
            'col_f': f_idx,
            'section_id': section_id,
            'section_title': section_title
        })
    i += 1

print(f"Detected {len(questions)} assessment questions.")

FULL_QUESTIONS = {
    1: "You assign a critical task to a reliable team member. They completely drop the ball at the last minute because they were overwhelmed with personal studies causing a visible delay in the event schedule. How do you handle the immediate delay, and how do you address the situation with the team member afterward?",
    2: "During a council meeting, you propose an initiative. Everyone nods and agrees in person, but later that evening, you find out they are complaining heavily about your plan in a private group chat without you. How do you address this issue with the team and handle their private complaints?",
    3: "You are responsible for selecting 5 volunteers for a major college event. Your best friend is desperate to join but is clearly less capable than another student who applied. Your friend corners you, expecting to be chosen. What decision do you make and how do you communicate it to your friend?",
    4: "The Technical Team and the Creative Team are locked in a fierce argument over a stage design. The deadline is tomorrow morning, and both sides refuse to compromise, threatening to walk out. As the student council mediator, how do you resolve the standoff and ensure the stage is ready on time?",
    5: "A senior council member publicly accuses you during a general body meeting of mismanaging funds for a minor workshop. You know your documentation is perfectly clean, but the crowd is already gossiping. How do you respond in the moment and restore your credibility?",
    6: "It is 15 minutes before the main cultural event begins. The venue's main power grid fails, plunging the auditorium into darkness. The backup generator will take 20 minutes to spin up, and the audience is already seated in the dark. What immediate actions do you take to manage the crowd and the delay?",
    7: "Your title sponsor promises ₹1,00,000 for your event, but due to a corporate policy shift, they officially pull out their funding just 5 days before the event. Your expenses are already locked in. How do you bridge the financial shortfall and save the event without compromising quality?",
    8: "An hour before a major guest lecture, three issues hit at once: The college dean is upset because the front row seats aren't labeled, the student checking IDs at the gate is getting into a physical altercation, and the main auditorium mic has heavy static feedback. If you can only attend to one problem immediately, which one do you handle personally, how do you delegate the other two, and why?",
    9: "You are leading a team of 6 people for an upcoming fest. Nobody is listening to your instructions. To make matters tougher, two members are technically much better at the task than you are, while another is openly hostile. The deadline is in 3 days. How do you assert leadership, delegate effectively, and deliver the project?",
    10: "The college administration informs you at 4:00 PM today that you must host an engagement activity for 150 incoming freshmen tomorrow morning at 9:00 AM. You have zero budget and no external permissions. Outline your complete event concept, activity name, and execution steps to make it engaging and successful.",
    11: "If your student council tenure was a movie, would it be a high-stakes corporate thriller, an unpredictable comedy of errors, or an inspirational sports drama? Choose one, and explain how that choice reflects your leadership style and approach to student council challenges.",
    12: "Which trait is more damaging to a student council's reputation: A highly competent leader who is completely unapproachable and arrogant, or a highly approachable and loved leader who consistently misses deadlines? Explain and justify your choice.",
    13: 'Imagine your computer\'s desktop is a giant physical office desk. If a "file" is like a single homework paper, what is a "folder" like?',
    14: "What is a web browser (like Chrome, Safari, or Edge) best compared to?",
    15: 'If you make a digital shopping list on your phone where item #1 is "apples," item #2 is "milk," and item #3 is "bread," how does the computer remember the order?',
    16: "int a = 25;int b = 5;print(a / b + a % b);",
    17: "What is a web address (like example.com) most like in the real world?",
    18: "Why is a password like a secret key to a treasure chest?",
    19: 'If your computer or phone is a musical instrument like a piano, what is the "software" (the apps and games) like?',
    20: 'int a = 15;int b = 4;print(a % b + " " + a / b);',
    21: 'What is making a "backup" copy of your favorite digital photos most like?',
    22: 'When you click "Delete" on a file you don\'t want anymore, where does it usually go first on a computer?',
    23: "int a = 18;int b = 3;print(a + b * 2);",
    24: 'What is a digital "computer virus" most like?',
    25: "What is a Wi-Fi connection most like?",
    26: 'Why do tech support teams often ask you to "turn it off and back on again" when a device freezes?',
    27: 'When you save a photo to "the Cloud," where is it actually being stored?',
    28: "DBMS: A table contains customer information. The same customer's phone number appears in multiple rows unnecessarily. Which database concept helps reduce such redundancy?"
}

dataset = {
    'metadata': {
        'title': 'General Assessment Response Viewer',
        'subtitle': 'Student Council Assessment Response Viewer',
        'total_respondents': len(records),
        'total_questions': len(questions),
        'total_pairs': len(records) * len(questions),
        'sections': [
            {
                'id': 'A',
                'title': 'Section A: Leadership & Situational Assessment',
                'description': 'Scenarios evaluating team leadership, conflict resolution, crisis management, and integrity.',
                'question_numbers': list(range(1, 13))
            },
            {
                'id': 'B',
                'title': 'Section B: Technical & Computing Assessment',
                'description': 'Questions covering fundamentals of computers, systems, networks, coding expressions, and database management.',
                'question_numbers': list(range(13, 29))
            }
        ]
    },
    'questions': [
        {
            'number': q['q_num'],
            'text': FULL_QUESTIONS.get(q['q_num'], q['header'].strip()),
            'section_id': q['section_id'],
            'section_title': q['section_title']
        } for q in questions
    ],
    'respondents': []
}

SELECTED_CANDIDATES = [
    {"sr_no": 1, "excel_id": 9, "short_name": "Mahalakshmi"},
    {"sr_no": 2, "excel_id": 24, "short_name": "Bhavna"},
    {"sr_no": 3, "excel_id": 15, "short_name": "Khizar"},
    {"sr_no": 4, "excel_id": 19, "short_name": "Aashika"},
    {"sr_no": 5, "excel_id": 26, "short_name": "Kumkum"},
    {"sr_no": 6, "excel_id": 22, "short_name": "Sam"},
    {"sr_no": 7, "excel_id": 16, "short_name": "Dhanashree"},
    {"sr_no": 8, "excel_id": 14, "short_name": "Sonal"},
    {"sr_no": 9, "excel_id": 28, "short_name": "Vaishnavi"},
    {"sr_no": 10, "excel_id": 20, "short_name": "Viraj"},
    {"sr_no": 11, "excel_id": 8, "short_name": "Vinay"},
    {"sr_no": 12, "excel_id": 2, "short_name": "Prem"},
    {"sr_no": 13, "excel_id": 29, "short_name": "Anshuman"}
]

# Index records by row ID (cell 0)
records_by_id = {}
for r in records:
    if r[0] is not None:
        records_by_id[int(r[0])] = r

dataset['metadata']['total_respondents'] = len(SELECTED_CANDIDATES)
dataset['metadata']['total_pairs'] = len(SELECTED_CANDIDATES) * len(questions)

total_blank_answers = 0
blank_details = []

for item in SELECTED_CANDIDATES:
    sr_no = item['sr_no']
    excel_id = item['excel_id']
    r = records_by_id.get(excel_id)
    if not r:
        print(f"Warning: Record for Excel ID {excel_id} not found!")
        continue
        
    full_name = str(r[8]).strip() if r[8] is not None else item['short_name']
    division = str(r[11]).strip() if r[11] is not None else ''
    
    responses = []
    answered_count = 0
    
    for q in questions:
        ans_raw = r[q['col_q']]
        ans_val = str(ans_raw) if ans_raw is not None else None
        
        pts_raw = r[q['col_p']] if q['col_p'] is not None else None
        pts_val = str(pts_raw) if pts_raw is not None else None
        
        fb_raw = r[q['col_f']] if q['col_f'] is not None else None
        fb_val = str(fb_raw) if fb_raw is not None else None
        
        is_answered = ans_val is not None and ans_val.strip() != ''
        if is_answered:
            answered_count += 1
        else:
            total_blank_answers += 1
            blank_details.append({
                'id': sr_no,
                'name': full_name,
                'q_num': q['q_num'],
                'question': q['header'][:50]
            })
            
        responses.append({
            'question_number': q['q_num'],
            'question': FULL_QUESTIONS.get(q['q_num'], q['header'].strip()),
            'section_id': q['section_id'],
            'section_title': q['section_title'],
            'answer': ans_val,
            'points': pts_val,
            'feedback': fb_val,
            'is_answered': is_answered
        })
        
    dataset['respondents'].append({
        'id': sr_no,
        'sr_no': sr_no,
        'original_excel_id': excel_id,
        'short_name': item['short_name'],
        'name': full_name,
        'division': division,
        'total_questions': len(questions),
        'answered_count': answered_count,
        'unanswered_count': len(questions) - answered_count,
        'responses': responses
    })

# Write data/assessment.json
json_path = os.path.join(base_dir, 'data', 'assessment.json')
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(dataset, f, ensure_ascii=False, indent=2)
print(f"Generated {json_path} ({os.path.getsize(json_path)} bytes)")

# Write js/data.js (bundled fallback for file:// browsing without CORS restrictions)
js_data_path = os.path.join(base_dir, 'js', 'data.js')
with open(js_data_path, 'w', encoding='utf-8') as f:
    f.write("// General Assessment Dataset - bundled static source for offline/file:// protocol support\n")
    f.write("window.ASSESSMENT_DATA = ")
    json.dump(dataset, f, ensure_ascii=False)
    f.write(";\n")
print(f"Generated {js_data_path} ({os.path.getsize(js_data_path)} bytes)")

# Run Validation
print("\n" + "="*50)
print("DATA INTEGRITY & VALIDATION SUMMARY")
print("="*50)
print(f"Total Respondents Imported: {len(dataset['respondents'])}")
print(f"Total Questions Imported: {len(dataset['questions'])}")
print(f"Total Q&A Pairs: {len(dataset['respondents']) * len(dataset['questions'])}")
print(f"Total Answered Responses: {sum(r['answered_count'] for r in dataset['respondents'])}")
print(f"Total Blank Responses: {total_blank_answers}")

div_map = {}
for r in dataset['respondents']:
    div_map[r['division']] = div_map.get(r['division'], 0) + 1
print("Division Breakdown:", div_map)

print(f"\nBlank Cells Breakdown ({len(blank_details)} total):")
for b in blank_details:
    print(f" - Respondent #{b['id']} ({b['name']}): Q{b['q_num']} [{b['question']}...]")

# Verify against Excel directly
print("\nVerifying Selected Candidate mapping against Excel...")
mismatch_count = 0
for i, sc in enumerate(SELECTED_CANDIDATES):
    parsed = dataset['respondents'][i]
    r = records_by_id.get(sc['excel_id'])
    if parsed['id'] != sc['sr_no']:
        print(f"Mismatch ID: expected {sc['sr_no']} vs parsed {parsed['id']}")
        mismatch_count += 1
    if parsed['name'] != (str(r[8]).strip() if r[8] is not None else sc['short_name']):
        print(f"Mismatch Name for {sc['short_name']}")
        mismatch_count += 1
    for q_idx, q in enumerate(questions):
        excel_ans = r[q['col_q']]
        excel_ans_str = str(excel_ans) if excel_ans is not None else None
        parsed_ans = parsed['responses'][q_idx]['answer']
        if excel_ans_str != parsed_ans:
            print(f"Mismatch Answer for {sc['short_name']} Q{q['q_num']}")
            mismatch_count += 1

if mismatch_count == 0:
    print("SUCCESS: 100% of 13 selected candidates and responses match Excel row-for-row with 0 mismatches!")
    import subprocess
    subprocess.run([sys.executable, os.path.join(base_dir, 'build_offline_html.py')], check=True)
else:
    print(f"WARNING: {mismatch_count} mismatches found!")

