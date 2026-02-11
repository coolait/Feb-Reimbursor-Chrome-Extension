"""
Flask server for the FEB Auto Reimbursor extension.
POST /combine with JSON: { "link1": "...", "link2": "...", "filename": "..." }
Downloads both files from Google Drive, combines (PDFs + images, decrypts encrypted PDFs), returns PDF.

Deploy to Render (or any free Python host) so the Chrome extension can call it.
"""

import os
import sys
import tempfile
import traceback
from pathlib import Path

# Run from repo root so we can import combine_drive_files
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from flask import Flask, request, send_file, jsonify
from combine_drive_files import process_file, combine_pdfs

app = Flask(__name__)


@app.after_request
def cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


@app.route("/combine", methods=["OPTIONS"])
def combine_options():
    return "", 204


@app.route("/combine", methods=["POST"])
def combine():
    data = request.get_json(silent=True) or {}
    link1 = (data.get("link1") or data.get("link_1") or "").strip()
    link2 = (data.get("link2") or data.get("link_2") or "").strip()
    filename = (data.get("filename") or "combined.pdf").strip()
    if not filename.endswith(".pdf"):
        filename += ".pdf"

    if not link1 or not link2:
        return jsonify({"error": "Need link1 and link2"}), 400

    temp_dir = tempfile.mkdtemp(prefix="feb_combine_")
    try:
        pdf1 = process_file(link1, temp_dir)
        pdf2 = process_file(link2, temp_dir)
        output_path = os.path.join(temp_dir, filename)
        combine_pdfs([pdf1, pdf2], output_path)
        return send_file(
            output_path,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=filename,
        )
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            for f in Path(temp_dir).iterdir():
                f.unlink()
            os.rmdir(temp_dir)
        except Exception:
            pass


@app.route("/")
def index():
    return "FEB PDF combiner. POST JSON to /combine with link1, link2, filename."


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8765))
    app.run(host="0.0.0.0", port=port)
