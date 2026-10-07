import os
import re

base_dir = os.path.dirname(os.path.abspath(__file__))

index_path = os.path.join(base_dir, 'index.html')
css_path = os.path.join(base_dir, 'css', 'styles.css')
data_js_path = os.path.join(base_dir, 'js', 'data.js')
search_js_path = os.path.join(base_dir, 'js', 'search.js')
eval_js_path = os.path.join(base_dir, 'js', 'evaluation.js')
app_js_path = os.path.join(base_dir, 'js', 'app.js')

with open(index_path, 'r', encoding='utf-8') as f:
    html = f.read()

with open(css_path, 'r', encoding='utf-8') as f:
    css = f.read()

with open(data_js_path, 'r', encoding='utf-8') as f:
    data_js = f.read()

with open(search_js_path, 'r', encoding='utf-8') as f:
    search_js = f.read()

with open(eval_js_path, 'r', encoding='utf-8') as f:
    eval_js = f.read()

with open(app_js_path, 'r', encoding='utf-8') as f:
    app_js = f.read()

# Inline CSS
html = html.replace(
    '<link rel="stylesheet" href="css/styles.css">',
    f'<style>\n{css}\n</style>'
)

# Inline JS scripts
scripts_block = f"""
  <script>
{data_js}
  </script>
  <script>
{search_js}
  </script>
  <script>
{eval_js}
  </script>
  <script>
{app_js}
  </script>
"""

# Replace external script inclusions
pattern = r'<!-- Bundled Data Script.*?<script src="js/app.js"></script>'
html = re.sub(pattern, scripts_block.strip(), html, flags=re.DOTALL)

# Also ensure counter text in offline html shows 1 of 13 and tabs show 13, 7, 6
html = html.replace('All (31)', 'All (13)')
html = html.replace('Div A (14)', 'Div A (7)')
html = html.replace('Div B (17)', 'Div B (6)')
html = html.replace('Candidate 1 of 31', 'Candidate 1 of 13')

# Write output files
output_offline = os.path.join(base_dir, 'general_assessment_offline.html')
with open(output_offline, 'w', encoding='utf-8') as f:
    f.write(html)

output_offline2 = os.path.join(base_dir, 'offline_viewer.html')
with open(output_offline2, 'w', encoding='utf-8') as f:
    f.write(html)

print(f"Generated {output_offline} ({os.path.getsize(output_offline)} bytes)")
print(f"Generated {output_offline2} ({os.path.getsize(output_offline2)} bytes)")
