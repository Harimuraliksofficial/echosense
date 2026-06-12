"""
preprocess.py — Image preprocessing utilities.

NOTE: This module is no longer used by the Segmind AI pipeline.
The previous Stable Diffusion / ControlNet pipeline used Canny edge 
detection locally, but the Segmind SDXL ControlNet Scribble endpoint
handles all preprocessing server-side.

Kept for reference / potential future local-model fallback.
"""

import base64
import io
import cv2
import numpy as np
from PIL import Image

def process_base64_image(b64_string):
    """
    Decodes a base64 image string into a PIL Image and a CV2 Image.
    """
    try:
        if "," in b64_string:
            b64_data = b64_string.split(",")[1]
        else:
            b64_data = b64_string
            
        img_data = base64.b64decode(b64_data)
        pil_image = Image.open(io.BytesIO(img_data)).convert("RGB")
        
        open_cv_image = np.array(pil_image)
        open_cv_image = open_cv_image[:, :, ::-1].copy() 
        return pil_image, open_cv_image
    except Exception as e:
        print("Error parsing base64 image:", e)
        return None, None

def get_canny_edges(cv2_image, low_thresh=100, high_thresh=200):
    """
    Extracts edges from an image using Canny.
    """
    gray = cv2.cvtColor(cv2_image, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, low_thresh, high_thresh)
    edges = edges[:, :, None]
    edges = np.concatenate([edges, edges, edges], axis=2)
    return Image.fromarray(edges)
