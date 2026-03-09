"""
Archimedes Analysis Runner — Modal Serverless Function

Executes AI-generated Python analysis code in a sandboxed container
with pre-installed data science libraries.

Deploy: modal deploy modal/analysis_runner.py
The resulting URL is set as MODAL_ENDPOINT_URL in your .env
"""

import modal
import json
import time
import base64
import os
import sys
import io
import traceback

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "fastapi[standard]",
    "numpy",
    "pandas",
    "scipy",
    "matplotlib",
    "seaborn",
    "scikit-learn",
    "statsmodels",
    "openpyxl",
    "Pillow",
    "opencv-python-headless",
)

app = modal.App("archimedes-analysis", image=image)

ALLOWED_IMPORTS = {
    "numpy", "pandas", "scipy", "matplotlib", "seaborn",
    "sklearn", "statsmodels", "math", "statistics", "json",
    "collections", "itertools", "functools", "re", "io",
    "os", "warnings", "datetime", "textwrap",
}

MAX_FIGURES = 10
MAX_OUTPUT_FILES = 10
MAX_OUTPUT_FILE_SIZE = 5 * 1024 * 1024  # 5 MB per output file
EXECUTION_TIMEOUT = 120  # seconds
MAX_STDOUT = 50_000  # characters

FIGURE_EXTENSIONS = {".png", ".svg", ".jpg", ".jpeg"}
OUTPUT_EXTENSIONS = {".csv", ".json", ".xlsx", ".txt", ".tsv", ".html"}


def collect_figures(figures_dir: str) -> list[str]:
    """Read all image files from the figures dir as base64 data URIs."""
    figures = []
    if not os.path.exists(figures_dir):
        return figures
    for fname in sorted(os.listdir(figures_dir)):
        fpath = os.path.join(figures_dir, fname)
        ext = os.path.splitext(fname)[1].lower()
        if os.path.isfile(fpath) and ext in FIGURE_EXTENSIONS:
            with open(fpath, "rb") as f:
                data = base64.b64encode(f.read()).decode("utf-8")
                mime = {
                    ".png": "image/png",
                    ".svg": "image/svg+xml",
                    ".jpg": "image/jpeg",
                    ".jpeg": "image/jpeg",
                }.get(ext, "image/png")
                figures.append(f"data:{mime};base64,{data}")
            if len(figures) >= MAX_FIGURES:
                break
    return figures


def collect_output_files(output_dir: str) -> list[dict]:
    """Read generated output files (CSV, JSON, etc.) as base64 with metadata."""
    output_files = []
    if not os.path.exists(output_dir):
        return output_files
    for fname in sorted(os.listdir(output_dir)):
        fpath = os.path.join(output_dir, fname)
        ext = os.path.splitext(fname)[1].lower()
        if not os.path.isfile(fpath):
            continue
        if ext not in OUTPUT_EXTENSIONS:
            continue
        if os.path.getsize(fpath) > MAX_OUTPUT_FILE_SIZE:
            continue
        with open(fpath, "rb") as f:
            data = base64.b64encode(f.read()).decode("utf-8")
        mime = {
            ".csv": "text/csv",
            ".json": "application/json",
            ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".txt": "text/plain",
            ".tsv": "text/tab-separated-values",
            ".html": "text/html",
        }.get(ext, "application/octet-stream")
        output_files.append({
            "filename": fname,
            "mime_type": mime,
            "base64": data,
        })
        if len(output_files) >= MAX_OUTPUT_FILES:
            break
    return output_files


def write_input_files(files: list[dict], input_dir: str) -> dict[str, str]:
    """Write base64-encoded files to disk and return a filename -> path mapping."""
    file_paths = {}
    os.makedirs(input_dir, exist_ok=True)
    for f in files:
        filename = f.get("filename", "file")
        b64 = f.get("base64", "")
        if not b64:
            continue
        fpath = os.path.join(input_dir, filename)
        with open(fpath, "wb") as fh:
            fh.write(base64.b64decode(b64))
        file_paths[filename] = fpath
    return file_paths


@app.function(timeout=180, memory=2048, keep_warm=1)
@modal.fastapi_endpoint(method="POST")
def run_analysis(request: dict) -> dict:
    """
    Execute analysis code in a sandboxed environment.

    Input: { "code": str, "data": dict, "results_summary": str, "files": [{"filename", "mime_type", "base64"}] }
    Output: { "success": bool, "stdout": str, "stderr": str, "figures": [str], "execution_time_ms": int }
    """
    import matplotlib
    matplotlib.use("Agg")  # Non-interactive backend
    import matplotlib.pyplot as plt

    code = request.get("code", "")
    data = request.get("data", {})
    results_summary = request.get("results_summary", "")
    files = request.get("files", [])

    if not code.strip():
        return {
            "success": False,
            "stdout": "",
            "stderr": "No code provided",
            "figures": [],
            "execution_time_ms": 0,
        }

    # Set up directories
    figures_dir = "/tmp/figures"
    output_dir = "/tmp/output_files"
    input_dir = "/tmp/input_files"

    for d in [figures_dir, output_dir, input_dir]:
        os.makedirs(d, exist_ok=True)
        for f in os.listdir(d):
            os.remove(os.path.join(d, f))

    # Write uploaded files to input dir
    file_paths = write_input_files(files, input_dir) if files else {}

    # Capture stdout/stderr
    stdout_capture = io.StringIO()
    stderr_capture = io.StringIO()

    # Build execution namespace
    namespace = {
        "data": data,
        "results_summary": results_summary,
        "FIGURES_DIR": figures_dir,
        "OUTPUT_DIR": output_dir,  # for saving CSV, JSON, Excel output files
        "INPUT_DIR": input_dir,
        "FILE_PATHS": file_paths,  # dict: filename -> absolute path
        "__builtins__": __builtins__,
    }

    start_time = time.time()
    success = False

    old_stdout = sys.stdout
    old_stderr = sys.stderr

    try:
        sys.stdout = stdout_capture
        sys.stderr = stderr_capture

        # Set matplotlib to save to our figures dir by default
        plt.close("all")

        exec(code, namespace)
        success = True

    except Exception:
        traceback.print_exc(file=stderr_capture)

    finally:
        # Save any open matplotlib figures
        try:
            fig_nums = plt.get_fignums()
            for i, num in enumerate(fig_nums):
                fig = plt.figure(num)
                fig_path = os.path.join(figures_dir, f"auto_figure_{i}.png")
                if not os.path.exists(fig_path):
                    fig.savefig(fig_path, dpi=150, bbox_inches="tight", facecolor="white")
            plt.close("all")
        except Exception:
            pass

        sys.stdout = old_stdout
        sys.stderr = old_stderr

    execution_time_ms = int((time.time() - start_time) * 1000)

    stdout_text = stdout_capture.getvalue()[:MAX_STDOUT]
    stderr_text = stderr_capture.getvalue()[:MAX_STDOUT]

    figures = collect_figures(figures_dir)
    output_files = collect_output_files(output_dir)

    return {
        "success": success,
        "stdout": stdout_text,
        "stderr": stderr_text,
        "figures": figures,
        "output_files": output_files,  # [{filename, mime_type, base64}]
        "execution_time_ms": execution_time_ms,
    }
