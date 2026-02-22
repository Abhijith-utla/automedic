import torch
from torch.utils.data import Dataset, DataLoader
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import copy
import pandas as pd
from datetime import datetime, timedelta

text = f"I’ve been feeling really fatigued for the past couple of weeks, and I keep getting these headaches that don’t seem to go away. Have you noticed any other symptoms, like dizziness, nausea, or changes in vision? Yeah, sometimes I feel a bit dizzy when I stand up quickly, and my vision gets a little blurry now and then. Also, I’ve been more thirsty than usual and need to urinate frequently. Alright, that’s helpful. Based on your symptoms—fatigue, persistent headaches, dizziness, blurred vision, increased thirst, and frequent urination—it could indicate several things, including dehydration, anemia, or blood sugar issues. Have you had your blood pressure or blood sugar checked recently? Not really. I haven’t had any lab work in the past year. Okay, I recommend we run some basic blood tests, including a complete blood count and a metabolic panel. This will check for anemia, electrolyte imbalances, and your blood glucose levels. Depending on the results, we may also consider checking your thyroid function. In the meantime, make sure you’re drinking enough water and monitoring your symptoms closely. Got it. Should I be worried about anything serious right now? Most likely, it’s something manageable, but it’s important we do the tests to rule out conditions like diabetes or thyroid disorders. If you experience severe headaches, vision changes that worsen suddenly, or confusion, you should come in immediately."

tokenizer = AutoTokenizer.from_pretrained("../bartDistill", local_files_only=True, trust_remote_code=True)

model = AutoModelForSeq2SeqLM.from_pretrained("../bartDistill", local_files_only=True)

# Tokenize input text
inputs = tokenizer(text, return_tensors="pt", max_length=1024, truncation=True)

before = datetime.now()

# Generate summary
summary_ids = model.generate(
    inputs["input_ids"],
    num_beams=4,       # for better summaries
    max_length=150,    # max tokens in summary
    early_stopping=True
)

# Decode summary back to text
summary = tokenizer.decode(summary_ids[0], skip_special_tokens=True)

print("Summary:")
print(summary)

laterTime = datetime.now()
print(f"Time difference is {(laterTime - before).total_seconds()}")
