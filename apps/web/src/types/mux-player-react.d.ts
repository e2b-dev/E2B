declare module '@mux/mux-player-react' {
  export interface MuxPlayerProps {
    [key: string]: any;
    playbackId: string;
    metadata?: Record<string, any>;
  }

  export default function MuxPlayer(props: MuxPlayerProps): JSX.Element
}