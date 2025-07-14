/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, Type } from "@google/genai";

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const recordButton = document.getElementById('record-button') as HTMLButtonElement | null;
  const playPronunciationButton = document.getElementById('play-pronunciation-button') as HTMLButtonElement | null;
  const buttonText = recordButton?.querySelector('.button-text') as HTMLSpanElement | null;
  const feedbackText = document.getElementById('feedback-text') as HTMLParagraphElement | null;
  const wordDisplay = document.getElementById('word-display') as HTMLDivElement | null;
  const wordSelectionContainer = document.getElementById('word-selection') as HTMLDivElement | null;
  const modeEnText = document.getElementById('mode-en-text') as HTMLInputElement | null;
  const modeKoVoice = document.getElementById('mode-ko-voice') as HTMLInputElement | null;
  const modeLabels = document.querySelectorAll('#feedback-mode-selector label');
  const scoreContainer = document.getElementById('score-container') as HTMLDivElement | null;
  const scoreBar = document.getElementById('score-bar') as HTMLDivElement | null;
  const scoreText = document.getElementById('score-text') as HTMLSpanElement | null;
  const toggleMeaningButton = document.getElementById('toggle-meaning-button') as HTMLButtonElement | null;
  const wordMeaning = document.getElementById('word-meaning') as HTMLParagraphElement | null;


  // --- State & Constants ---
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const words = ['일학년', '이학년', '삼학년', '사학년', '대학생', '미국', '사람', '인사', '학년', '학생', '한국', '저', '안녕하세요', '이에요', '예요', '과', '도'];
  const wordTranslations: { [key: string]: string } = {
    '일학년': 'First Grade',
    '이학년': 'Second Grade',
    '삼학년': 'Third Grade',
    '사학년': 'Fourth Grade',
    '대학생': 'University Student',
    '미국': 'USA',
    '사람': 'Person',
    '인사': 'Greeting',
    '학년': 'School Year / Grade',
    '학생': 'Student',
    '한국': 'Korea',
    '저': 'I / Me (formal)',
    '안녕하세요': 'Hello',
    '이에요': 'is/am/are (after consonant)',
    '예요': 'is/am/are (after vowel)',
    '과': 'and / with',
    '도': 'also / too'
  };
  const placeholderFeedback = 'Your feedback will be displayed here.';
  let isRecording = false;
  let currentWord = words[0];
  let feedbackMode = 'en-text'; // 'en-text' or 'ko-voice'
  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];

  // --- Functions ---

  function setupWordSelection() {
    if (!wordSelectionContainer) return;
    words.forEach(word => {
      const button = document.createElement('button');
      button.textContent = word;
      button.classList.add('word-button');
      button.addEventListener('click', () => {
        currentWord = word;
        updateWordDisplay();
        document.querySelectorAll('.word-button').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        resetFeedback();
        updateAndHideMeaning();
      });
      wordSelectionContainer.appendChild(button);
    });
    
    const firstButton = wordSelectionContainer.querySelector('.word-button');
    firstButton?.classList.add('active');
  }

  function updateWordDisplay() {
    if (wordDisplay) {
      wordDisplay.textContent = currentWord;
    }
  }

  function updateAndHideMeaning() {
    if (wordMeaning && toggleMeaningButton) {
        wordMeaning.textContent = wordTranslations[currentWord];
        wordMeaning.classList.add('hidden');
        toggleMeaningButton.textContent = 'Show Meaning';
        wordMeaning.setAttribute('aria-hidden', 'true');
    }
  }

  function setupModeSelection() {
    modeEnText?.addEventListener('change', () => {
      if(modeEnText.checked) {
        feedbackMode = 'en-text';
        updateModeLabels();
      }
    });
    modeKoVoice?.addEventListener('change', () => {
      if(modeKoVoice.checked) {
        feedbackMode = 'ko-voice';
        updateModeLabels();
      }
    });
    updateModeLabels();
  }

  function updateModeLabels() {
    modeLabels.forEach(label => {
      const correspondingInput = document.getElementById(label.getAttribute('for')!) as HTMLInputElement;
      if (correspondingInput.checked) {
        label.classList.add('active');
      } else {
        label.classList.remove('active');
      }
    });
  }

  function resetFeedback() {
    if (feedbackText) {
      feedbackText.textContent = placeholderFeedback;
      feedbackText.classList.remove('generated');
    }
    if (scoreContainer) {
        scoreContainer.classList.add('hidden');
    }
    if(scoreBar){
        scoreBar.style.width = '0%';
    }
    if(scoreText){
        scoreText.textContent = '0%';
    }
  }

  async function startRecording() {
    resetFeedback();
    audioChunks = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };
      mediaRecorder.onstop = getPronunciationFeedback;
      mediaRecorder.start();
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Could not access the microphone. Please check permissions.');
      isRecording = false; // Reset state if permission denied
      updateButtonState();
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
  }

  function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function getPronunciationFeedback() {
    if (!feedbackText) return;
    if (audioChunks.length === 0) {
      feedbackText.textContent = 'No audio recorded. Please try again.';
      feedbackText.classList.add('generated');
      return;
    }

    feedbackText.textContent = 'Generating feedback...';
    feedbackText.classList.remove('generated');

    try {
      const audioBlob = new Blob(audioChunks, { type: mediaRecorder?.mimeType || 'audio/webm' });
      const audioData = await blobToBase64(audioBlob);

      const lang = feedbackMode === 'en-text' ? 'English' : 'Korean';
      const systemInstruction = `You are a Korean pronunciation coach evaluating the user's attempt to say: "${currentWord}".
Your response MUST be a single, valid JSON object with "score" (integer 0-100) and "feedback" (string).
- First, verify the user pronounced "${currentWord}". If not, score is 0 and feedback explains the error.
- If correct, score the pronunciation fairly. Be a constructive, friendly tutor.
- The feedback must be in ${lang}.`;
      const userPrompt = `This audio contains my attempt at pronouncing "${currentWord}". Please analyze it and provide feedback.`;

      const audioPart = {
        inlineData: { mimeType: audioBlob.type, data: audioData },
      };

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [audioPart, { text: userPrompt }] },
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.INTEGER, description: 'A score from 0-100 for pronunciation accuracy.' },
              feedback: { type: Type.STRING, description: 'Constructive feedback on the pronunciation.' },
            }
          }
        }
      });
      
      let rawText = response.text.trim();
      
      // Handle potential markdown code block wrapping from the model
      if (rawText.startsWith('```json')) {
        rawText = rawText.substring(7, rawText.length - 3).trim();
      } else if (rawText.startsWith('```')) {
        rawText = rawText.substring(3, rawText.length - 3).trim();
      }

      const result = JSON.parse(rawText);

      if (!result || typeof result.score === 'undefined' || typeof result.feedback === 'undefined') {
        throw new Error('Invalid JSON structure received from API.');
      }

      updateFeedback(result.feedback);
      updateScore(result.score);

    } catch (error) {
      console.error('Error getting feedback from AI:', error);
      feedbackText.textContent = 'An error occurred while generating feedback. Please try again.';
      feedbackText.classList.add('generated');
    }
  }

  function updateFeedback(text: string) {
    if (feedbackText) {
      feedbackText.textContent = text;
      feedbackText.classList.add('generated');
    }

    if (feedbackMode === 'ko-voice') {
      speakWord(text);
    }
  }

  function updateScore(score: number) {
    if (!scoreContainer || !scoreBar || !scoreText) return;

    scoreContainer.classList.remove('hidden');
    scoreBar.style.width = `${score}%`;
    scoreText.textContent = `${score}%`;
    
    scoreBar.classList.remove('score-low', 'score-medium', 'score-high');

    if (score < 50) {
        scoreBar.classList.add('score-low');
    } else if (score < 80) {
        scoreBar.classList.add('score-medium');
    } else {
        scoreBar.classList.add('score-high');
    }
  }
  
  function speakWord(word: string) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'ko-KR';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    } else {
      alert('Sorry, your browser does not support voice playback.');
    }
  }

  function updateButtonState() {
    if (!recordButton || !buttonText) return;
    
    if (isRecording) {
      recordButton.classList.add('recording');
      recordButton.setAttribute('aria-label', 'Stop Recording');
      buttonText.textContent = 'Recording...';
    } else {
      recordButton.classList.remove('recording');
      recordButton.setAttribute('aria-label', 'Start Recording');
      buttonText.textContent = 'Start Recording';
    }
  }

  // --- Event Listeners & Initial Setup ---

  if (recordButton) {
    recordButton.addEventListener('click', () => {
      isRecording = !isRecording;
      
      if (isRecording) {
        startRecording();
      } else {
        stopRecording();
      }
      updateButtonState();
    });
  }

  if (playPronunciationButton) {
    playPronunciationButton.addEventListener('click', () => {
      if(currentWord) {
        speakWord(currentWord);
      }
    });
  }

  if (toggleMeaningButton && wordMeaning) {
    toggleMeaningButton.addEventListener('click', () => {
        const isHidden = wordMeaning.classList.toggle('hidden');
        toggleMeaningButton.textContent = isHidden ? 'Show Meaning' : 'Hide Meaning';
        wordMeaning.setAttribute('aria-hidden', String(isHidden));
    });
  }

  setupWordSelection();
  updateWordDisplay();
  updateAndHideMeaning();
  setupModeSelection();
  resetFeedback();
});