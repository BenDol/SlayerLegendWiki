/**
 * Test OpenAI Moderation API
 * Tests various text inputs to see what gets flagged
 */

import dotenv from 'dotenv';
dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not found in .env file');
  process.exit(1);
}

async function testModeration(text, label) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${label}`);
  console.log(`Text: "${text}"`);
  console.log('-'.repeat(60));

  try {
    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: text
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ API Error:', error);
      return;
    }

    const data = await response.json();
    const result = data.results[0];

    console.log(`\n🔍 Result: ${result.flagged ? '🚫 FLAGGED' : '✅ CLEAN'}`);

    if (result.flagged) {
      console.log('\n⚠️  Flagged Categories:');
      for (const [category, flagged] of Object.entries(result.categories)) {
        if (flagged) {
          const score = result.category_scores[category];
          console.log(`  - ${category}: ${(score * 100).toFixed(2)}%`);
        }
      }
    }

    console.log('\n📊 All Scores:');
    for (const [category, score] of Object.entries(result.category_scores)) {
      const percentage = (score * 100).toFixed(4);
      const bar = '█'.repeat(Math.floor(score * 50));
      console.log(`  ${category.padEnd(25)} ${percentage.padStart(8)}% ${bar}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Test cases
async function runTests() {
  console.log('🧪 OpenAI Moderation API Test\n');
  console.log('Testing various display names to see what gets flagged...\n');

  // Clean examples
  await testModeration('John Smith', 'Clean - Normal name');
  await testModeration('DragonSlayer99', 'Clean - Gaming username');
  await testModeration('ProGamer', 'Clean - Gaming reference');

  // Mild profanity (commonly filtered)
  await testModeration('BadAss_Player', 'Mild - Contains "ass"');
  await testModeration('DamnGoodPlayer', 'Mild - Contains "damn"');

  // Strong profanity (should be flagged)
  await testModeration('F***ingAwesome', 'Strong - Censored F-word');
  await testModeration('S***tyPlayer', 'Strong - Censored S-word');

  // Hate speech (should be flagged)
  await testModeration('I hate all gamers', 'Hate - Negative sentiment');

  // Harassment
  await testModeration('You are trash and should quit', 'Harassment - Insulting');

  // Sexual content
  await testModeration('SexyPlayer69', 'Sexual - Suggestive username');

  // Violence
  await testModeration('KillAllEnemies', 'Violence - Game-related kill reference');
  await testModeration('I will murder you', 'Violence - Direct threat');

  console.log(`\n${'='.repeat(60)}`);
  console.log('✅ Testing complete!');
  console.log(`${'='.repeat(60)}\n`);

  console.log('💡 Tips:');
  console.log('  - Scores above 0.5 typically indicate problematic content');
  console.log('  - OpenAI flags based on context, not just word lists');
  console.log('  - Gaming terms like "kill" may have low scores in game context');
  console.log('  - Test with your actual use cases to tune thresholds\n');
}

runTests();
