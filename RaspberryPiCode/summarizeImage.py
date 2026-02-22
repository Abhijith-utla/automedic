from transformers import BlipProcessor, BlipForConditionalGeneration
from PIL import Image
import torch
from datetime import datetime

# Load BLIP processor and model
processor = BlipProcessor.from_pretrained("VisionModel", local_files_only=True, trust_remote_code=True)
model = BlipForConditionalGeneration.from_pretrained("VisionModel", local_files_only=True, trust_remote_code=True)

# Load your image
image = Image.open("../iStock-490287154_480x480.webp").convert("RGB")

prevTime = datetime.now()

# Prepare inputs
inputs = processor(images=image, return_tensors="pt")

# Generate caption
with torch.no_grad():
    output_ids = model.generate(**inputs, max_length=50)
caption = processor.decode(output_ids[0], skip_special_tokens=True)

print("Caption:", caption)

nowTime = datetime.now()

print(f"Current time is {(nowTime - prevTime).total_seconds()}")
