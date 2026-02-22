/**
 * Placeholder paragraphs simulating data from hardware. Kept short so the model runs quickly.
 * In production these will be sent from the device as two summaries.
 */
export const MOCK_HARDWARE_PARAGRAPH_1 =
  "Chest pain and heaviness ~2h. Denies SOB, nausea. No cardiac history. BP 138/88, HR 82, RR 16, SpO2 98%, afebrile. Alert, mild distress.";

export const MOCK_HARDWARE_PARAGRAPH_2 =
  "Visual: holding chest (central). Normal skin, no diaphoresis. Limited mobility. Anxious.";

export function getMockHardwareParagraphs(): { paragraph1: string; paragraph2: string } {
  return {
    paragraph1: MOCK_HARDWARE_PARAGRAPH_1,
    paragraph2: MOCK_HARDWARE_PARAGRAPH_2,
  };
}
