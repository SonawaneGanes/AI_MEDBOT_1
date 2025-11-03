/*
  # AI Doctor Chatbot Database Schema

  1. New Tables
    - `chat_sessions`
      - `id` (uuid, primary key) - Unique session identifier
      - `user_id` (uuid, nullable) - Links to auth.users if authenticated
      - `created_at` (timestamptz) - Session start time
      - `last_active` (timestamptz) - Last activity timestamp
    
    - `chat_messages`
      - `id` (uuid, primary key) - Unique message identifier
      - `session_id` (uuid, foreign key) - Links to chat_sessions
      - `role` (text) - Either 'user' or 'assistant'
      - `content` (text) - Message content
      - `metadata` (jsonb) - Additional data (confidence, source, etc.)
      - `created_at` (timestamptz) - Message timestamp
    
    - `medical_knowledge`
      - `id` (uuid, primary key) - Unique knowledge entry
      - `question` (text) - Medical question/symptom
      - `answer` (text) - Medical information/guidance
      - `category` (text) - Medical category (e.g., symptom, condition)
      - `confidence` (float) - Reliability score
      - `source` (text) - Information source
      - `created_at` (timestamptz) - Entry creation time
      - `updated_at` (timestamptz) - Last update time
    
    - `user_reports`
      - `id` (uuid, primary key) - Unique report identifier
      - `session_id` (uuid, foreign key) - Links to chat_sessions
      - `file_name` (text) - Original file name
      - `file_type` (text) - File MIME type
      - `extracted_text` (text) - OCR extracted text
      - `created_at` (timestamptz) - Upload timestamp

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated and anonymous users
    - Anonymous users can create sessions and chat
    - Authenticated users can access their own data
*/

-- Create chat_sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  last_active timestamptz DEFAULT now()
);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create chat sessions"
  ON chat_sessions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view their own sessions"
  ON chat_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Anonymous users can view their sessions"
  ON chat_sessions FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Users can update their own sessions"
  ON chat_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES chat_sessions(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert messages"
  ON chat_messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can view messages"
  ON chat_messages FOR SELECT
  TO anon, authenticated
  USING (true);

-- Create medical_knowledge table
CREATE TABLE IF NOT EXISTS medical_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  category text DEFAULT 'general',
  confidence float DEFAULT 0.8,
  source text DEFAULT 'system',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE medical_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read medical knowledge"
  ON medical_knowledge FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can add knowledge"
  ON medical_knowledge FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create user_reports table
CREATE TABLE IF NOT EXISTS user_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES chat_sessions(id) ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  extracted_text text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can upload reports"
  ON user_reports FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can view reports"
  ON user_reports FOR SELECT
  TO anon, authenticated
  USING (true);

-- Insert sample medical knowledge
INSERT INTO medical_knowledge (question, answer, category, confidence, source) VALUES
('What should I do if I have a headache?', 'For mild headaches, try resting in a quiet, dark room, staying hydrated, and taking over-the-counter pain relievers like acetaminophen or ibuprofen. If headaches are severe, frequent, or accompanied by other symptoms like vision changes, fever, or neck stiffness, please consult a healthcare provider immediately.', 'symptom', 0.9, 'system'),
('I have a fever. What should I do?', 'For fever management: rest adequately, drink plenty of fluids, take acetaminophen or ibuprofen as directed, and monitor your temperature. Seek medical attention if fever exceeds 103°F (39.4°C), lasts more than 3 days, or is accompanied by severe symptoms like difficulty breathing, chest pain, or confusion.', 'symptom', 0.9, 'system'),
('What are the symptoms of hypertension?', 'Hypertension (high blood pressure) often has no obvious symptoms, which is why it is called the "silent killer." Some people may experience headaches, shortness of breath, or nosebleeds, but these are not specific. Regular blood pressure monitoring is essential. If you have concerns about hypertension, please consult a healthcare provider for proper diagnosis and management.', 'condition', 0.9, 'system'),
('How can I improve my sleep quality?', 'To improve sleep quality: maintain a consistent sleep schedule, create a comfortable sleep environment (dark, quiet, cool), avoid caffeine and heavy meals before bedtime, limit screen time 1-2 hours before sleep, exercise regularly (but not close to bedtime), and practice relaxation techniques. If sleep problems persist, consult a healthcare provider.', 'wellness', 0.85, 'system'),
('What are signs of dehydration?', 'Common signs of dehydration include: dark yellow urine, decreased urination, dry mouth and lips, fatigue, dizziness, confusion, and rapid heartbeat. For mild dehydration, increase fluid intake with water or electrolyte solutions. Seek immediate medical attention for severe dehydration symptoms like very dark urine, extreme confusion, rapid breathing, or fainting.', 'symptom', 0.9, 'system'),
('When should I see a doctor for a cough?', 'See a doctor if your cough: lasts more than 3 weeks, produces blood or thick green/yellow mucus, is accompanied by high fever, chest pain, or difficulty breathing, causes wheezing or shortness of breath, or occurs with unexplained weight loss. Seek immediate care for severe breathing difficulty or chest pain.', 'symptom', 0.9, 'system'),
('What are the warning signs of diabetes?', 'Warning signs of diabetes include: increased thirst and urination, unexplained weight loss, extreme hunger, fatigue, blurred vision, slow-healing sores, frequent infections, and tingling in hands or feet. If you experience these symptoms, consult a healthcare provider for blood sugar testing and proper evaluation.', 'condition', 0.9, 'system'),
('How do I know if I have food poisoning?', 'Food poisoning symptoms typically include: nausea, vomiting, diarrhea, abdominal cramps, and sometimes fever. Symptoms usually appear within hours of eating contaminated food. Most cases resolve within 48 hours with rest and hydration. Seek medical attention if you have: bloody diarrhea, high fever (above 101.5°F), signs of dehydration, or symptoms lasting more than 3 days.', 'condition', 0.85, 'system')
ON CONFLICT DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_medical_knowledge_category ON medical_knowledge(category);
CREATE INDEX IF NOT EXISTS idx_user_reports_session_id ON user_reports(session_id);