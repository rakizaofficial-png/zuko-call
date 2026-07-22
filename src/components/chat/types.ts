/**
 * Shared chat contract — User App and Host App must render identical UI from
 * these shapes. Copy this folder into the Host App for parity.
 */
export type ChatMessageSide = "me" | "them";

export type ChatMessage = {
  id: string;
  from: ChatMessageSide;
  text: string;
  at: number;
  imageUrl?: string;
  /** Outbound read receipt — false = sent, true/undefined = read */
  read?: boolean;
  /** Optional sender label (support admin, system, etc.) */
  senderLabel?: string;
};

export type ChatComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  sending?: boolean;
  placeholder?: string;
  disabled?: boolean;
};
