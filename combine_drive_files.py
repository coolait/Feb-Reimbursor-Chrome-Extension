"""
Script to combine two Google Drive files (PDF, PNG, or JPEG) into one PDF.

Usage:
    python combine_drive_files.py
"""

import requests
import os
import tempfile
from pathlib import Path
from PIL import Image
import PyPDF2
from io import BytesIO
import re
import shutil

# Try to import gdown for better Google Drive support
try:
    import gdown
    GDOWN_AVAILABLE = True
except ImportError:
    GDOWN_AVAILABLE = False


def convert_google_drive_link(shareable_link):
    """
    Convert a Google Drive shareable link to a direct download link.
    
    Args:
        shareable_link: Google Drive shareable link (e.g., https://drive.google.com/file/d/FILE_ID/view?usp=sharing)
    
    Returns:
        Tuple of (file_id, direct download link)
    """
    # Extract file ID from the shareable link
    if '/file/d/' in shareable_link:
        file_id = shareable_link.split('/file/d/')[1].split('/')[0]
    elif 'id=' in shareable_link:
        file_id = shareable_link.split('id=')[1].split('&')[0]
    else:
        raise ValueError("Invalid Google Drive link format")
    
    # Return file ID and direct download link
    return file_id, f"https://drive.google.com/uc?export=download&id={file_id}"


def download_file(url, output_path):
    """
    Download a file from a URL to a local path.
    
    Args:
        url: URL to download from
        output_path: Local path to save the file
    
    Returns:
        Path to the downloaded file
    """
    print(f"Downloading file from: {url}")
    response = requests.get(url, stream=True)
    response.raise_for_status()
    
    with open(output_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    
    print(f"File downloaded to: {output_path}")
    return output_path


def image_to_pdf(image_path, output_pdf_path):
    """
    Convert an image (PNG, JPEG) to PDF.
    
    Args:
        image_path: Path to the image file
        output_pdf_path: Path to save the PDF
    """
    print(f"Converting image {image_path} to PDF...")
    image = Image.open(image_path)
    
    # Convert RGBA to RGB if necessary
    if image.mode == 'RGBA':
        rgb_image = Image.new('RGB', image.size, (255, 255, 255))
        rgb_image.paste(image, mask=image.split()[3])  # Use alpha channel as mask
        image = rgb_image
    elif image.mode != 'RGB':
        image = image.convert('RGB')
    
    image.save(output_pdf_path, 'PDF', resolution=100.0)
    print(f"Image converted to PDF: {output_pdf_path}")


def combine_pdfs(pdf_paths, output_path):
    """
    Combine multiple PDF files into one.
    Decrypts with empty password when needed (e.g. bank statement PDFs).
    """
    print(f"Combining {len(pdf_paths)} PDF files...")
    pdf_merger = PyPDF2.PdfMerger()
    for pdf_path in pdf_paths:
        print(f"  Adding: {pdf_path}")
        reader = PyPDF2.PdfReader(pdf_path)
        if getattr(reader, 'is_encrypted', False):
            reader.decrypt("")
        pdf_merger.append(reader)
    pdf_merger.write(output_path)
    pdf_merger.close()
    print(f"Combined PDF saved to: {output_path}")


def download_from_google_drive(file_id, temp_dir):
    """
    Download a file from Google Drive using multiple methods.
    
    Args:
        file_id: Google Drive file ID
        temp_dir: Temporary directory to save files
    
    Returns:
        Path to the downloaded file
    """
    # First, try using gdown if available (better for Google Drive)
    if GDOWN_AVAILABLE:
        try:
            print("Attempting download using gdown library...")
            url = f"https://drive.google.com/uc?id={file_id}"
            temp_file_path = os.path.join(temp_dir, f"gdown_{file_id}")
            gdown.download(url, temp_file_path, quiet=False, fuzzy=True)
            
            # Check if file was downloaded successfully
            if os.path.exists(temp_file_path) and os.path.getsize(temp_file_path) > 0:
                print("Successfully downloaded using gdown!")
                return temp_file_path
            else:
                print("gdown download failed, trying alternative method...")
        except Exception as e:
            print(f"gdown failed: {e}, trying alternative method...")
    
    # Fallback to requests method
    session = requests.Session()
    
    # Method 1: Try direct download
    download_url = f"https://drive.google.com/uc?export=download&id={file_id}"
    response = session.get(download_url, stream=True, allow_redirects=True)
    
    # Check if we got HTML (means we need to handle virus scan warning or large file)
    content_type = response.headers.get('Content-Type', '').lower()
    content = b''
    
    # Read first chunk to check if it's HTML
    for chunk in response.iter_content(chunk_size=8192):
        content += chunk
        if len(content) > 1000:  # Read enough to detect HTML
            break
    
    # Check if response is HTML
    if b'<!doctype' in content.lower() or b'<html' in content.lower() or 'text/html' in content_type:
        print("Detected HTML response, trying alternative download method...")
        
        # Method 2: Try with confirm parameter
        download_url = f"https://drive.google.com/uc?export=download&confirm=t&id={file_id}"
        response = session.get(download_url, stream=True, allow_redirects=True)
        content = b''
        for chunk in response.iter_content(chunk_size=8192):
            content += chunk
            if len(content) > 1000:
                break
        
        # If still HTML, try to extract download link from the page
        if b'<!doctype' in content.lower() or b'<html' in content.lower():
            print("Still HTML, attempting to parse download link...")
            # Try to find the download link in the HTML
            html_content = content.decode('utf-8', errors='ignore')
            
            # Check if it's an authentication page
            if 'sign in' in html_content.lower() or 'signin' in html_content.lower():
                raise ValueError(
                    "This file requires authentication. Please make the file publicly accessible:\n"
                    "1. Right-click the file in Google Drive\n"
                    "2. Click 'Share'\n"
                    "3. Change access to 'Anyone with the link' can view\n"
                    "4. Copy the new shareable link and try again"
                )
            
            # Look for the download link pattern
            # Google Drive often has: href="/uc?export=download&id=..." or similar
            match = re.search(r'href="(/uc\?export=download[^"]+)"', html_content)
            if match:
                download_url = "https://drive.google.com" + match.group(1)
                response = session.get(download_url, stream=True, allow_redirects=True)
            else:
                # Try alternative pattern
                match = re.search(r'id="uc-download-link"[^>]*href="([^"]+)"', html_content)
                if match:
                    download_url = "https://drive.google.com" + match.group(1)
                    response = session.get(download_url, stream=True, allow_redirects=True)
                else:
                    # Last resort: try the alternative API endpoint
                    download_url = f"https://drive.google.com/uc?id={file_id}&export=download"
                    response = session.get(download_url, stream=True, allow_redirects=True)
    
    # Determine file extension from Content-Type or default
    content_type = response.headers.get('Content-Type', '').lower()
    file_extension = '.tmp'
    
    if 'pdf' in content_type:
        file_extension = '.pdf'
    elif 'png' in content_type:
        file_extension = '.png'
    elif 'jpeg' in content_type or 'jpg' in content_type:
        file_extension = '.jpg'
    
    # Create temporary file
    temp_file = tempfile.NamedTemporaryFile(delete=False, dir=temp_dir, suffix=file_extension)
    temp_file_path = temp_file.name
    temp_file.close()
    
    # Download the entire file
    with open(temp_file_path, 'wb') as f:
        # Write the content we already read
        if content:
            f.write(content)
        # Write the rest
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    
    return temp_file_path


def process_file(google_drive_link, temp_dir):
    """
    Download a file from Google Drive and convert it to PDF if needed.
    
    Args:
        google_drive_link: Google Drive shareable link
        temp_dir: Temporary directory to save files
    
    Returns:
        Path to the PDF file (original or converted)
    """
    # Convert Google Drive link to get file ID
    file_id, _ = convert_google_drive_link(google_drive_link)
    
    # Download the file
    temp_file_path = download_from_google_drive(file_id, temp_dir)
    
    # Check actual file type by reading first bytes
    with open(temp_file_path, 'rb') as f:
        file_header = f.read(4)
    
    # Determine file type from magic bytes
    if file_header.startswith(b'%PDF'):
        # It's a PDF
        print(f"File is a PDF: {temp_file_path}")
        return temp_file_path
    elif file_header.startswith(b'\x89PNG'):
        # It's a PNG
        print(f"File is a PNG: {temp_file_path}")
        pdf_path = os.path.splitext(temp_file_path)[0] + '.pdf'
        image_to_pdf(temp_file_path, pdf_path)
        os.remove(temp_file_path)  # Remove original image
        return pdf_path
    elif file_header.startswith(b'\xff\xd8\xff'):
        # It's a JPEG
        print(f"File is a JPEG: {temp_file_path}")
        pdf_path = os.path.splitext(temp_file_path)[0] + '.pdf'
        image_to_pdf(temp_file_path, pdf_path)
        os.remove(temp_file_path)  # Remove original image
        return pdf_path
    else:
        # Try reading more bytes to see if it's HTML
        with open(temp_file_path, 'rb') as f:
            more_content = f.read(100)
        if b'<!doctype' in more_content.lower() or b'<html' in more_content.lower():
            raise ValueError("Google Drive returned an HTML page instead of the file. The file may be too large or require permission. Please make sure the file is publicly accessible or try a different link format.")
        raise ValueError(f"Unsupported file type. File header: {file_header}")


def main():
    """
    Main function to combine two Google Drive files into one PDF.
    """
    print("=" * 60)
    print("Google Drive File Combiner")
    print("=" * 60)
    print()
    
    # Get the project directory (where this script is located)
    project_dir = Path(__file__).parent.absolute()
    
    # Create temp and outputs directories within the project
    temp_dir = project_dir / "temp"
    outputs_dir = project_dir / "outputs"
    
    # Create directories if they don't exist
    temp_dir.mkdir(exist_ok=True)
    outputs_dir.mkdir(exist_ok=True)
    
    print(f"Using project temp directory: {temp_dir}")
    print(f"Outputs will be saved to: {outputs_dir}")
    print()
    
    # Get Google Drive links from user
    print("Enter the first Google Drive link (PDF, PNG, or JPEG):")
    link1 = input().strip()
    
    print("\nEnter the second Google Drive link (PDF, PNG, or JPEG):")
    link2 = input().strip()
    
    # Get output filename
    print("\nEnter output PDF filename (default: combined_output.pdf):")
    output_filename = input().strip()
    if not output_filename:
        output_filename = "combined_output.pdf"
    if not output_filename.endswith('.pdf'):
        output_filename += '.pdf'
    
    # Full path for output file
    output_path = outputs_dir / output_filename
    
    try:
        # Process both files
        pdf_paths = []
        
        print("\n" + "=" * 60)
        print("Processing first file...")
        print("=" * 60)
        pdf1 = process_file(link1, str(temp_dir))
        pdf_paths.append(pdf1)
        
        print("\n" + "=" * 60)
        print("Processing second file...")
        print("=" * 60)
        pdf2 = process_file(link2, str(temp_dir))
        pdf_paths.append(pdf2)
        
        # Combine PDFs
        print("\n" + "=" * 60)
        print("Combining files...")
        print("=" * 60)
        combine_pdfs(pdf_paths, str(output_path))
        
        print("\n" + "=" * 60)
        print(f"SUCCESS! Combined PDF saved as: {output_path}")
        print("=" * 60)
        
    except Exception as e:
        print(f"\nERROR: {str(e)}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Clean up temporary files (but keep the temp directory)
        print(f"\nCleaning up temporary files...")
        for file in temp_dir.glob("*"):
            try:
                if file.is_file():
                    file.unlink()
            except Exception as e:
                print(f"Warning: Could not delete {file}: {e}")
        print("Done!")


if __name__ == "__main__":
    main()

