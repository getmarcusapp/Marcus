// Shared data for the Emotions tab and the Past Triggers history screen.

export const EMOTION_COLORS = {
  anger:       { bg: '#FDF0EF', border: '#E8A09A', text: '#C0504A', tint: 'rgba(232,160,154,0.12)' },
  anxiety:     { bg: '#EFF4FD', border: '#9AB4E8', text: '#4A6EC0', tint: 'rgba(154,180,232,0.12)' },
  frustration: { bg: '#FDF8EF', border: '#E8C87A', text: '#A07830', tint: 'rgba(232,200,122,0.12)' },
  shame:       { bg: '#F5EFFd', border: '#C09AE8', text: '#7050B0', tint: 'rgba(192,154,232,0.12)' },
  avoidance:   { bg: '#EFF8F5', border: '#7AC8B4', text: '#307870', tint: 'rgba(122,200,180,0.12)' },
  envy:        { bg: '#EFF8EF', border: '#80C880', text: '#307030', tint: 'rgba(128,200,128,0.12)' },
  grief:       { bg: '#F0F0F8', border: '#A0A0D0', text: '#505090', tint: 'rgba(160,160,208,0.12)' },
  fear:        { bg: '#FDF2EF', border: '#E8B09A', text: '#B06040', tint: 'rgba(232,176,154,0.12)' },
  other:       { bg: '#F5F5F5', border: '#C0C0C0', text: '#707070', tint: 'rgba(192,192,192,0.10)' },
};

export const DISTORTIONS = [
  { id: 'catastrophizing', label: 'Catastrophizing', q: 'Am I imagining the worst possible outcome?' },
  { id: 'mind_reading', label: 'Mind-reading', q: 'Am I assuming I know what others think or feel?' },
  { id: 'overgeneralizing', label: 'Overgeneralizing', q: 'Am I treating one event as a permanent pattern?' },
  { id: 'personalizing', label: 'Personalizing', q: 'Am I taking responsibility for things outside my control?' },
  { id: 'filtering', label: 'Filtering', q: 'Am I ignoring the good and fixating on the bad?' },
  { id: 'emotional_reasoning', label: 'Emotional reasoning', q: 'Am I treating a feeling as proof that something is true?' },
  { id: 'should_statements', label: 'Should statements', q: 'Am I imposing rigid rules on myself or others?' },
  { id: 'all_or_nothing', label: 'All-or-nothing thinking', q: 'Am I seeing this as all-or-nothing, with no middle ground?' },
  { id: 'labeling', label: 'Labeling', q: 'Am I reducing myself or someone else to a fixed label?' },
];
