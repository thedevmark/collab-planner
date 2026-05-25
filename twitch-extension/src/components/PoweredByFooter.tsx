interface Props {
  campaign: string;
}

export function PoweredByFooter({ campaign }: Props) {
  const href = `https://collab.deutschmark.online/?utm_source=twitch_ext&utm_medium=panel&utm_campaign=${campaign}`;
  return (
    <footer className="powered-by">
      <a href={href} target="_blank" rel="noopener noreferrer">
        Powered by Collab Planner <span aria-hidden="true">↗</span>
      </a>
    </footer>
  );
}
