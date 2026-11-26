/**
 * Recollections (spec §6.5): the last trace of someone forgotten.
 * Indices: stage N uses N*10-10 .. N*10-1. In each stage, 0–5 drop from Remnants,
 * 6 from the midboss Elegy and 7–9 from the boss Elegies (captured).
 */
export interface Recollection {
  stage: number;
  text: string;
}

export const RECOLLECTIONS: readonly Recollection[] = [
  // Stage 1: Fields of Unharvested Names
  { stage: 1, text: 'A woman named Teru taught her son to whistle. Neither of them remembers now.' },
  { stage: 1, text: 'Every spring, someone left the first rice ball of the harvest on this stone. The stone remains.' },
  { stage: 1, text: 'Two brothers argued over a fence line for thirty years. The fence is the only thing that remembers them.' },
  { stage: 1, text: 'A girl hid a letter in the scarecrow’s sleeve, for a boy who never came to read it.' },
  { stage: 1, text: 'There was a dog who waited by the irrigation gate each evening. The gate is gone. The dog is still waiting.' },
  { stage: 1, text: 'An old farmer counted the terraces aloud every morning, so none of them would feel left out.' },
  { stage: 1, text: 'The crows used to follow one woman home. She fed them on the first frost. They still circle, looking for her door.' },
  { stage: 1, text: 'Somebody planted this field the morning their daughter was born. They meant to tell her, when she was old enough.' },
  { stage: 1, text: 'A grandmother named every crow on the ridge. When she was forgotten, so were their names.' },
  { stage: 1, text: 'A widower built a scarecrow because he could not stand an empty field. He gave it his wife’s straw hat.' },

  // Stage 2: The Drowned Lantern Market
  { stage: 2, text: 'A lantern-maker painted a different face on every lantern, so the dark would never feel alone.' },
  { stage: 2, text: 'Two sweethearts met on the third bridge every evening for forty years. Neither remembers which bridge.' },
  { stage: 2, text: 'A boy sold his first memory of snow to buy medicine for his sister. He never missed it. That was the worst part.' },
  { stage: 2, text: 'A noodle stall stayed open all night for the canal boatmen. The broth recipe drowned with it.' },
  { stage: 2, text: 'Someone carved two initials into this bench. One of them was loved very much.' },
  { stage: 2, text: 'A ferry bell rang at closing time. The town still pauses, sometimes, without knowing why.' },
  { stage: 2, text: 'A farmer floated a straw boat downriver every harvest, carrying a thank-you to whoever waited at the sea.' },
  { stage: 2, text: 'A merchant forgave every debt on the night of her daughter’s wedding. The ledger still has the page torn out.' },
  { stage: 2, text: 'On festival nights the whole town set wishes on the water in paper lanterns. Most wished for nothing to change.' },
  { stage: 2, text: 'The first thing a child named Ume ever remembered was her mother laughing. She pawned it last, and for the most.' },

  // Stage 3: The Library of Kinder Endings
  { stage: 3, text: 'A librarian stamped every returned book with a tiny drawing of a cat. No one asked why while they could.' },
  { stage: 3, text: 'A soldier’s letter home ended mid-sentence. His mother finished it herself every night, a different way.' },
  { stage: 3, text: 'Someone underlined one sentence in every book they borrowed. Together, the sentences tell a story nobody has read.' },
  { stage: 3, text: 'A child returned a book thirty years late with a note: “Sorry. I wasn’t finished being sad.”' },
  { stage: 3, text: 'Old men argued about poetry in the reading room until dawn. They never once agreed. They never once stopped coming.' },
  { stage: 3, text: 'A translator spent her whole life on one book. The original is gone. Hers is the only version left.' },
  { stage: 3, text: 'The moths in the archive only eat endings. The beginnings are all still there, waiting.' },
  { stage: 3, text: 'The war had a name once. A footnote remembers the name of one soldier’s horse.' },
  { stage: 3, text: 'A censor blacked out one line of a love letter: the part where she admitted she was afraid. The letter got through.' },
  { stage: 3, text: 'The original ending of this book was very sad. A woman reread it every year on the anniversary, and felt less alone.' },
];

export const RECOLLECTIONS_PER_STAGE = 10;

export function recollectionIndex(stage: number, slot: number): number {
  return (stage - 1) * RECOLLECTIONS_PER_STAGE + slot;
}
