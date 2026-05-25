interface Props {
  campaign: string;
  cta?: { label: string; url: string } | null;
}

export function PoweredByFooter({ campaign, cta }: Props) {
  if (cta) {
    return (
      <footer className="powered-by">
        <a className="cta" href={cta.url} target="_blank" rel="noopener noreferrer">
          {cta.label} <span aria-hidden="true">↗</span>
        </a>
      </footer>
    );
  }
  const href = `https://collab.deutschmark.online/?utm_source=twitch_ext&utm_medium=panel&utm_campaign=${campaign}`;
  return (
    <footer className="powered-by">
      <a href={href} target="_blank" rel="noopener noreferrer">
        Powered by Collab Planner <span aria-hidden="true">↗</span>
      </a>
    </footer>
  );
}
