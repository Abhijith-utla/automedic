import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
from datetime import datetime
import sys
import os

# Specify your file path here
FILE_PATH = "transcription.txt"

# Check file exists
if not os.path.exists(FILE_PATH):
    print(f"Error: File '{FILE_PATH}' not found.")
    sys.exit(1)

# Read text from file
with open(FILE_PATH, "r") as f:
    text = f.read().strip()

if not text:
    print("Error: File is empty.")
    sys.exit(1)

print(f"Loaded text from: {FILE_PATH}")
print(f"Text length: {len(text)} characters\n")

# Load model
tokenizer = AutoTokenizer.from_pretrained("../bartDistill", local_files_only=True, trust_remote_code=True)
model     = AutoModelForSeq2SeqLM.from_pretrained("../bartDistill", local_files_only=True)

# Tokenize
inputs = tokenizer(text, return_tensors="pt", max_length=1024, truncation=True)

before = datetime.now()

# Generate summary
summary_ids = model.generate(
    inputs["input_ids"],
    num_beams=4,
    max_length=150,
    early_stopping=True
)

summary = tokenizer.decode(summary_ids[0], skip_special_tokens=True)

later = datetime.now()

print("Summary:")
print(summary)
print(f"\nTime taken: {(later - before).total_seconds():.2f} seconds")

# Save summary to file
output_file = FILE_PATH.replace(".txt", "_summary.txt")
with open(output_file, "w") as f:
    f.write(summary)
print(f"Summary saved to: {output_file}")
