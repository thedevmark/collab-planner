// Recent games strip — Twitch box-art thumbnails for the top up-to-4
// games this streamer has played recently. Each thumbnail links to the
// game's Twitch directory page.
//
// Twitch's box-art CDN serves images at
//   https://static-cdn.jtvnw.net/ttv-boxart/{game_name}-{w}x{h}.jpg
// where game_name is URL-encoded. Width:height ratio is 3:4 (e.g. 144x192).
// No API call needed.

interface Props {
  games: string[];
}

const MAX_GAMES = 4;
const BOX_W = 78;
const BOX_H = 104; // 78 × 4/3 ≈ 104

function boxArtUrl(gameName: string): string {
  return `https://static-cdn.jtvnw.net/ttv-boxart/${encodeURIComponent(gameName)}-${BOX_W * 2}x${BOX_H * 2}.jpg`;
}

function directoryUrl(gameName: string): string {
  // Twitch directory URLs use the URL-encoded game name with spaces as %20.
  return `https://www.twitch.tv/directory/category/${encodeURIComponent(gameName.toLowerCase().replace(/\s+/g, "-"))}`;
}

export function RecentGames({ games }: Props) {
  const shown = games.slice(0, MAX_GAMES);
  if (shown.length === 0) return null;

  return (
    <div className="recent-games">
      <div className="recent-games-label">Recently played</div>
      <div className="recent-games-row">
        {shown.map((game) => (
          <a
            key={game}
            href={directoryUrl(game)}
            target="_blank"
            rel="noopener noreferrer"
            className="recent-game"
            title={game}
          >
            <span className="recent-game-art-wrap" style={{ width: BOX_W, height: BOX_H }}>
              <img
                className="recent-game-art"
                src={boxArtUrl(game)}
                alt=""
                loading="lazy"
                onError={(e) => {
                  // Hide broken images so the fallback title strip carries
                  (e.currentTarget as HTMLImageElement).style.opacity = "0";
                }}
              />
            </span>
            <span className="recent-game-name">{game}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
