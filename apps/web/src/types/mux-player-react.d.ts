declare module '@mux/mux-player-react' {
  export interface MuxPlayerProps {
    [key: string]: any;
    playbackId: string;
    metadata?: Record<string, any>;
    autoplay?: boolean;
    muted?: boolean;
    themeProps?: Record<string, any>;
    streamType?: 'on-demand' | 'live';
  }

  export default function MuxPlayer(props: MuxPlayerProps): JSX.Element
}