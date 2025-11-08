import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import traceback


app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "disease_model.pkl")
VECTORIZER_PATH = os.path.join(BASE_DIR, "vectorizer.pkl")
try:
    model = joblib.load(MODEL_PATH)
    vectorizer = joblib.load(VECTORIZER_PATH)
    print(f"✅ Model and vectorizer loaded successfully from:\n{MODEL_PATH}\n{VECTORIZER_PATH}")
except Exception as e:
    print("⚠️ Failed to load model/vectorizer:")
    traceback.print_exc()  # 👈 This prints the full stack trace
    model = None
    vectorizer = None

@app.route("/", methods=["POST"])
def predict():
    if model is None or vectorizer is None:
        return jsonify({"error": "Model not loaded"}), 500
    
    data = request.get_json()
    symptoms = data.get("symptoms", "")
    X = vectorizer.transform([symptoms])
    prediction = str(model.predict(X)[0])
    return jsonify({"prediction": prediction})

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000, debug=True)
