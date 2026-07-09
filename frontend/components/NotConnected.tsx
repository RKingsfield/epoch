import { Card, CardSubtitle, CardTitle } from './ui/Card';
import { LinkButton } from './ui/Button';

export function NotConnected({ what }: { what: string }) {
  return (
    <Card>
      <CardTitle>Not connected</CardTitle>
      <CardSubtitle>
        Connect Last.fm and Spotify to see {what}.
      </CardSubtitle>
      <div className="mt-6">
        <LinkButton href="/" variant="primary">
          ◂ jack in
        </LinkButton>
      </div>
    </Card>
  );
}
