from pathlib import Path
import subprocess


root_path = Path(__file__).parent.parent.resolve()

extensions = [
    'sphinx.ext.todo',
    'sphinx.ext.graphviz',
    'sphinxcontrib.drawio',
    'sphinxcontrib.plantuml',
    'sphinxcontrib.programoutput',
]

version = (root_path / 'VERSION').read_text().strip()
project = 'hat-manager'
copyright = '2020-2022, Hat Open AUTHORS'
master_doc = 'index'

html_theme = 'furo'
html_static_path = ['static']
html_css_files = ['custom.css']
html_use_index = False
html_show_sourcelink = False
html_show_sphinx = False
html_sidebars = {'**': ["sidebar/brand.html",
                        "sidebar/scroll-start.html",
                        "sidebar/navigation.html",
                        "sidebar/scroll-end.html"]}

todo_include_todos = True

p = subprocess.run(['which', 'drawio'], capture_output=True, check=True)
drawio_binary_path = p.stdout.decode('utf-8').strip()
