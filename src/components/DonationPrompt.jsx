import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import SpiritSprite from './SpiritSprite';
import spiritData from '../../public/data/spirit-characters.json';

// Default generic donation messages (used when no context provided)
const DEFAULT_DONATION_MESSAGES = [
  "Hey! Want to help keep this wiki running? ☕",
  "This wiki runs on coffee and community support! 💖",
  "Support us and we'll keep updating this wiki! 🎮",
  "Help us keep the servers alive! Every bit helps! ⚡",
  "Love this wiki? Consider supporting us! 🙏",
  "Your support keeps us going strong! 💪",
  "A small donation makes a big difference! ✨",
  "Help fuel our passion project! 🚀",
];

const DonationPrompt = ({ onClose, onDonate, messages = null }) => {
  const [stage, setStage] = useState('entering'); // entering, speaking, exiting, card
  const [message, setMessage] = useState('');
  const [displayedText, setDisplayedText] = useState('');
  const [randomSpirit, setRandomSpirit] = useState(null);
  const [speechBubbleVisible, setSpeechBubbleVisible] = useState(false);
  const messageIndexRef = useRef(0);
  const timeoutRefs = useRef([]);

  // Pick random spirit and message on mount
  useEffect(() => {
    const spirits = spiritData.spirits;
    const randomSpiritIndex = Math.floor(Math.random() * spirits.length);
    const randomSpiritData = spirits[randomSpiritIndex];

    // Map spirit ID from data (id field in JSON)
    setRandomSpirit({
      id: randomSpiritData.id,
      level: Math.floor(Math.random() * 3) + 4, // Random evolution level 4-6
      name: randomSpiritData.name
    });

    // Use context-specific messages if provided, otherwise use defaults
    const messagePool = messages && Array.isArray(messages) && messages.length >= 3
      ? messages
      : DEFAULT_DONATION_MESSAGES;

    const randomMessage = messagePool[Math.floor(Math.random() * messagePool.length)];
    setMessage(randomMessage);

    // Reset text display for new message
    messageIndexRef.current = 0;
    setDisplayedText('');

    // Cleanup timeouts on unmount
    return () => {
      timeoutRefs.current.forEach(clearTimeout);
    };
  }, [messages]);

  // Animation sequence
  useEffect(() => {
    if (!randomSpirit) return;

    // Stage 1: Spirit enters (elastic bounce)
    const enterTimeout = setTimeout(() => {
      setStage('speaking');
      setSpeechBubbleVisible(true);
    }, 800); // Wait for spirit to fully enter

    timeoutRefs.current.push(enterTimeout);

    return () => clearTimeout(enterTimeout);
  }, [randomSpirit]);

  // Typewriter effect for speech bubble
  useEffect(() => {
    if (stage !== 'speaking' || !message) return;

    if (messageIndexRef.current < message.length) {
      const charTimeout = setTimeout(() => {
        const nextChar = message[messageIndexRef.current];
        setDisplayedText(prev => prev + nextChar);
        messageIndexRef.current++;
      }, 50); // 50ms per character

      timeoutRefs.current.push(charTimeout);
      return () => clearTimeout(charTimeout);
    } else if (messageIndexRef.current >= message.length) {
      // Message complete, wait then exit
      const exitTimeout = setTimeout(() => {
        setStage('exiting');
        setSpeechBubbleVisible(false);
      }, 2000); // Show complete message for 2 seconds

      timeoutRefs.current.push(exitTimeout);
      return () => clearTimeout(exitTimeout);
    }
  }, [stage, displayedText, message]);

  // Handle spirit exit and card entrance
  useEffect(() => {
    if (stage === 'exiting') {
      const cardTimeout = setTimeout(() => {
        setStage('card');
      }, 600); // Wait for spirit to exit

      timeoutRefs.current.push(cardTimeout);
      return () => clearTimeout(cardTimeout);
    }
  }, [stage]);

  if (!randomSpirit) return null;

  return (
    <div className="fixed bottom-8 left-8 z-50 pointer-events-none">
      {/* Spirit and Speech Bubble */}
      {stage !== 'card' && (
        <div className="relative pointer-events-auto flex items-end gap-4">
          {/* Spirit */}
          <div
            className={`transition-all duration-700 ${
              stage === 'entering'
                ? 'translate-y-full opacity-0'
                : stage === 'exiting'
                ? 'translate-y-full opacity-0'
                : 'translate-y-0 opacity-100'
            }`}
            style={{
              animation: stage === 'entering' ? 'elasticBounceUp 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards' : 'none',
            }}
          >
            <SpiritSprite
              spiritId={randomSpirit.id}
              level={randomSpirit.level}
              animationType="idle"
              animated={true}
              size="large"
              showInfo={false}
              bare={true}
            />
          </div>

          {/* Speech Bubble */}
          {speechBubbleVisible && (
            <div
              className={`relative transition-all duration-500 ${
                stage === 'speaking' ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'
              }`}
              style={{
                animation: stage === 'speaking' ? 'bobSpeak 0.5s ease-in-out infinite alternate' : 'none',
                marginBottom: '80px', // Position up to align with mouth area
              }}
            >
              <div className="relative bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-xl border-2 border-blue-500 dark:border-blue-400 max-w-xs">
                <div className="text-gray-800 dark:text-gray-200 font-medium">
                  {displayedText}
                  {messageIndexRef.current < message.length && (
                    <span className="inline-block w-1 h-4 ml-1 bg-blue-500 animate-pulse" />
                  )}
                </div>

                {/* Speech bubble tail pointing left to spirit */}
                <div className="absolute -left-2 bottom-6 w-4 h-4 bg-white dark:bg-gray-800 border-l-2 border-b-2 border-blue-500 dark:border-blue-400 transform rotate-45" />
              </div>
            </div>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute -top-2 -right-2 bg-gray-800 dark:bg-gray-700 text-white rounded-full p-1.5 hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors shadow-lg"
            aria-label="Close donation prompt"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Donation Card */}
      {stage === 'card' && (
        <div
          className="pointer-events-auto transition-all duration-500 transform"
          style={{
            animation: 'slideInFromBottom 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards',
          }}
        >
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-900 rounded-xl p-4 shadow-2xl border-2 border-blue-500 dark:border-blue-400 max-w-xs">
            <div className="text-center mb-3">
              <div className="text-3xl mb-1.5">☕</div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5">
                Support Our Wiki
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Help keep this community project running!
              </p>
            </div>

            <div className="space-y-2">
              <button
                onClick={onDonate}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold py-2 px-4 rounded-lg shadow-lg transition-all transform hover:scale-105 text-sm"
              >
                ❤️ Donate Now
              </button>

              <button
                onClick={onClose}
                className="w-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium py-1.5 px-4 rounded-lg transition-colors text-sm"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes elasticBounceUp {
          0% {
            transform: translateY(120%);
            opacity: 0;
          }
          50% {
            transform: translateY(-10%);
            opacity: 1;
          }
          70% {
            transform: translateY(5%);
          }
          85% {
            transform: translateY(-2%);
          }
          100% {
            transform: translateY(0%);
            opacity: 1;
          }
        }

        @keyframes bobSpeak {
          0% {
            transform: translateY(0px);
          }
          100% {
            transform: translateY(-3px);
          }
        }

        @keyframes slideInFromBottom {
          0% {
            transform: translateY(120%);
            opacity: 0;
          }
          50% {
            transform: translateY(-5%);
          }
          100% {
            transform: translateY(0%);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default DonationPrompt;
