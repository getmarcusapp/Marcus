# Guided meditation scripts

Source for the seven audio files in assets/meditations/, built by
`node scripts/meditations.js build <id>` (voice: Theo Silk, ElevenLabs).

Format, one item per line:

- a line of text is spoken as one passage (sentences inside it get a short breath);
- `[[N]]` is N seconds of silence (the ambient pad keeps playing);
- `[[bell]]` strikes the singing bowl.

Pauses are placed by hand: 6 to 12 seconds between ideas, 20 to 45 seconds where
the script asks the listener to do something. Quotations follow the checked
library (constants/stoicQuotes.js) and name their translator in the comments.
