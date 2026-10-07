# General Assessment Response Viewer with Transparent Community Evaluation

A self-contained, mobile-first, dark-themed response viewer for reading original Student Council General Assessment responses, upgraded with an **identity-based transparent evaluation, voting, agreement, and 5-star rating system**.

---

## 🌐 Live Cloudflare Public URL
👉 **[https://titled-cookies-declared-manager.trycloudflare.com](https://titled-cookies-declared-manager.trycloudflare.com)**

*(Secure HTTPS tunnel accessible from any smartphone, tablet, or desktop anywhere in the world.)*

---

## ⚡ The Three Evaluation Mechanisms

The platform separates the evaluation experience into three distinct, transparent components:

1. **Voting (Primary Candidate Preference)**
   * Every participant casts **1 active primary vote** across all 31 candidates.
   * If a user votes for another candidate later, their vote moves seamlessly without duplication.
   * Transparently displays the total votes, percentage share, and the exact names of everyone who voted for that candidate.

2. **Agree / Disagree (Response Support)**
   * For every candidate, participants state whether they support the candidate's responses:
     * `👍 Agree`
     * `👎 Disagree`
   * Displays the Community Opinion percentage ratio (e.g., *82% Agree • 18% Disagree*) with real-time progress bars and lists of names for both sides.

3. **5-Star Rating System (Performance Score)**
   * Interactive 1 to 5 star rating widget (`★ 1/5` to `★ 5/5`).
   * Displays:
     * Average rating (e.g. `★ 4.2 / 5`)
     * Total ratings submitted
     * Rating distribution histogram breakdown ($5★, 4★, 3★, 2★, 1★$)
     * Individual rating record showing the exact stars awarded by each person.

---

## 👤 User Identification & Transparency

* **No Anonymous Actions**: Every vote, agreement/disagreement, and rating is tied to the participant's **Full Name** and optional **Student / Employee ID**.
* **Automatic Identity Prompt**: On first visit, a modal prompts users to enter their identity.
* **Persistent Identity**: Preserved in local browser storage, allowing returning users to see and update their previous decisions.
* **Transparent Participant Ledger**:
  * On each candidate's card: A live table shows every evaluator, their vote, their opinion, their star rating, and timestamp.
  * In the **Community Leaderboard**: A master ledger displays all registered evaluators and overall candidate rankings.

---

## 🛡️ Data Integrity & Security

* **Original Assessment Data Untouched**: The authoritative Excel assessment responses from `General Assessment(1-31).xlsx` remain 100% immutable.
* **SQLite ACID Backend**: Stored in `data/evaluation.db` using WAL mode with relational integrity:
  * `participants (id, name, student_id, created_at, last_seen)`
  * `votes (id, participant_id, candidate_id, created_at, updated_at)` with `UNIQUE(participant_id)`
  * `opinions (id, participant_id, candidate_id, opinion, created_at, updated_at)` with `UNIQUE(participant_id, candidate_id)`
  * `ratings (id, participant_id, candidate_id, rating, created_at, updated_at)` with `UNIQUE(participant_id, candidate_id)`
* **Server-Side Validation**: All inputs (star ratings 1–5, opinions agree/disagree, candidate IDs 1–31) are enforced server-side against unauthorized modification or duplicate voting.

---

## 🚀 How to Run Locally

### Option 1: Start Server & Cloudflare Tunnel
Double-click `Start-Cloudflare-Tunnel.bat` in `d:\AntiGravity D` or run:
```powershell
cd "d:\AntiGravity D\general-assessment-viewer"
python start_tunnel.py
```
This runs the local server on `http://127.0.0.1:8088` and publishes the live `*.trycloudflare.com` tunnel.

### Option 2: Standalone Local HTTP Server (Without Tunnel)
```powershell
cd "d:\AntiGravity D\general-assessment-viewer"
python server.py
```
Visit [http://localhost:8088](http://localhost:8088) in your browser.

---

## 📁 Architecture Overview

```
general-assessment-viewer/
├── server.py                        # Python HTTP REST API server & SQLite manager
├── start_tunnel.py                  # Cloudflare quick tunnel and server daemon
├── index.html                       # Responsive HTML5 markup with evaluation modals
├── css/
│   └── styles.css                   # Dark theme design system, star rating & ledger styles
├── js/
│   ├── app.js                       # Frontend state, event coordination & UI rendering
│   ├── evaluation.js                # API client for registration, voting, rating, & overview
│   ├── search.js                    # Search & division filtering engine
│   └── data.js                      # Bundled Excel assessment data fallback
├── data/
│   ├── assessment.json              # Canonical assessment questions and responses
│   └── evaluation.db                # SQLite database for participants, votes & ratings
├── assets/
│   └── icon.svg                     # Vector brand icon
├── General Assessment(1-31).xlsx    # Unaltered single source of truth
└── README.md
```
