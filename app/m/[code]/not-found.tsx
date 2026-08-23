import { MissionNotice } from '@/components/mission';

export default function MissionNotFound() {
  return (
    <MissionNotice
      stamp="File not found"
      title="No mission matches this code"
      tags={['MISSION FILE', 'NOT ON RECORD']}
      body={
        <>
          Mission codes are two digits followed by two letters — 32BF. Check the code on your
          confirmation, or open the file from the link in your mission email. Files are never
          deleted, so a valid code always resolves.
        </>
      }
    />
  );
}
