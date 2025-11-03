from flask import Flask, request, jsonify
import joblib
import os

app = Flask(__name__)

MODEL_PATH = r"D:\Machine-Learning-Projects\AI_MEDBOT_1\ml\models\disease_model.pkl"
VECTORIZER_PATH = r"D:\Machine-Learning-Projects\AI_MEDBOT_1\ml\models\vectorizer.pkl"

model = joblib.load(MODEL_PATH)
vectorizer = joblib.load(VECTORIZER_PATH)

@app.route("/", methods=["POST"])
def predict():
    data = request.get_json()
    symptoms = data.get("symptoms", "")
    X = vectorizer.transform([symptoms])
    prediction = model.predict(X)[0]
    return jsonify({"prediction": prediction})

if __name__ == "__main__":
    app.run(port=8000, debug=True)
