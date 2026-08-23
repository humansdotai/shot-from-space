import { MissionNotice } from '@/components/mission';

export default function SharedNotFound() {
  return (
    <MissionNotice
      stamp="File not accessible"
      title="No shared file at this address"
      tags={['SHARED FILE', 'NOT ON RECORD']}
      body="Shared mission files open at /s/ followed by the mission code and the key issued with the link. Use the link exactly as it was sent to you."
    />
  );
}
