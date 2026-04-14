export const morningQuotes = [
  { text: "You have power over your mind, not outside events. Realize this, and you will find strength.", author: "Marcus Aurelius", source: "Meditations" },
  { text: "The impediment to action advances action. What stands in the way becomes the way.", author: "Marcus Aurelius", source: "Meditations" },
  { text: "Waste no more time arguing about what a good man should be. Be one.", author: "Marcus Aurelius", source: "Meditations" },
  { text: "He who fears death will never do anything worthy of a living man.", author: "Seneca", source: "Letters" },
  { text: "It is not death that a man should fear, but he should fear never beginning to live.", author: "Marcus Aurelius", source: "Meditations" },
  { text: "Make the best use of what is in your power, and take the rest as it happens.", author: "Epictetus", source: "Enchiridion" },
  { text: "First say to yourself what you would be; then do what you have to do.", author: "Epictetus", source: "Discourses" },
  { text: "Receive without pride, relinquish without struggle.", author: "Marcus Aurelius", source: "Meditations" },
  { text: "The whole future lies in uncertainty: live immediately.", author: "Seneca", source: "On the Shortness of Life" },
  { text: "Begin at once to live, and count each separate day as a separate life.", author: "Seneca", source: "Letters" },
  { text: "Confine yourself to the present.", author: "Marcus Aurelius", source: "Meditations" },
  { text: "Do not indulge in dreams of what you have not, but count the blessings you actually possess.", author: "Marcus Aurelius", source: "Meditations" },
  { text: "How long are you going to wait before you demand the best for yourself?", author: "Epictetus", source: "Discourses" },
  { text: "Wealth consists not in having great possessions, but in having few wants.", author: "Epictetus", source: "Discourses" },
  { text: "Seek not that the things which happen should happen as you wish; but wish the things which happen to be as they are.", author: "Epictetus", source: "Enchiridion" },
  { text: "Man is disturbed not by things, but by the opinions about things.", author: "Epictetus", source: "Enchiridion" },
  { text: "We suffer more in imagination than in reality.", author: "Seneca", source: "Letters" },
  { text: "True happiness is to enjoy the present, without anxious dependence upon the future.", author: "Seneca", source: "Letters" },
  { text: "If it is not right, do not do it; if it is not true, do not say it.", author: "Marcus Aurelius", source: "Meditations" },
  { text: "The best revenge is not to be like your enemy.", author: "Marcus Aurelius", source: "Meditations" },
  { text: "Accept the things to which fate binds you, and love the people with whom fate brings you together.", author: "Marcus Aurelius", source: "Meditations" },
  { text: "It is not the man who has too little, but the man who craves more, that is poor.", author: "Seneca", source: "Letters" },
  { text: "He suffers more than necessary, who suffers before it is necessary.", author: "Seneca", source: "Letters" },
  { text: "Luck is what happens when preparation meets opportunity.", author: "Seneca", source: "Letters" },
  { text: "Retire into yourself as much as possible.", author: "Seneca", source: "Letters" },
  { text: "Where the disease is greatest, the physician is needed most.", author: "Epictetus", source: "Discourses" },
  { text: "No man is free who is not master of himself.", author: "Epictetus", source: "Discourses" },
  { text: "You become what you give your attention to.", author: "Epictetus", source: "Discourses" },
  { text: "It's not what happens to you, but how you react to it that matters.", author: "Epictetus", source: "Enchiridion" },
  { text: "The key is to keep company only with people who uplift you.", author: "Epictetus", source: "Discourses" },
];

export const eveningQuotes = [
  { text: "Let us prepare our minds as if we had come to the very end of life.", author: "Seneca", source: "Letters" },
  { text: "Ask yourself at day's end: What was ill done? What done? What left undone?", author: "Epictetus", source: "Discourses" },
  { text: "Perfection of character is this: to live each day as if it were your last.", author: "Marcus Aurelius", source: "Meditations" },
  { text: "I have lived. The course which Fortune set for me is finished.", author: "Seneca", source: "Letters" },
  { text: "Examine what you have done today — not with pride, but with honesty.", author: "Marcus Aurelius", source: "Meditations" },
  { text: "Sleep is a daily reminder that we can let go.", author: "Marcus Aurelius", source: "Meditations" },
  { text: "Today I escaped anxiety. Or no, I discarded it, because it was within me.", author: "Marcus Aurelius", source: "Meditations" },
  { text: "When you arise in the morning, think of what a precious privilege it is to be alive.", author: "Marcus Aurelius", source: "Meditations" },
  { text: "Dwell on the beauty of life. Watch the stars, and see yourself running with them.", author: "Marcus Aurelius", source: "Meditations" },
  { text: "The object of life is not to be on the side of the majority, but to escape finding oneself in the ranks of the insane.", author: "Marcus Aurelius", source: "Meditations" },
];

export const mementoMoriQuotes = [
  { text: "You could leave life right now. Let that determine what you do and say and think.", author: "Marcus Aurelius", source: "Meditations" },
  { text: "Think of yourself as dead. You have lived your life. Now take what's left and live it properly.", author: "Marcus Aurelius", source: "Meditations" },
  { text: "Let us postpone nothing. Let us balance life's books each day.", author: "Seneca", source: "Letters" },
  { text: "The person who fears death will never do anything worth doing.", author: "Seneca", source: "Letters" },
  { text: "How many have laid waste to your life when you were unaware of what you were losing?", author: "Seneca", source: "On the Shortness of Life" },
  { text: "It is not that we have a short time to live, but that we waste a good deal of it.", author: "Seneca", source: "On the Shortness of Life" },
  { text: "Death is not an evil. What is it then? The one law mankind has that is free of all discrimination.", author: "Seneca", source: "Letters" },
  { text: "Perfecting yourself is the foundation of perfecting everything else.", author: "Epictetus", source: "Discourses" },
  { text: "This day will not come again. What will you make of the hours you are given?", author: "Marcus Aurelius", source: "Meditations" },
  { text: "Did you live well today? Not perfectly — but with intention?", author: "Marcus Aurelius", source: "Meditations" },
];

export function getDailyQuote(pool, offset = 0) {
  const today = new Date();
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
  return pool[(dayOfYear + offset) % pool.length];
}