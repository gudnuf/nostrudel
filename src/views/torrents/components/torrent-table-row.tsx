import { memo, useMemo, useRef } from "react";
import { ButtonGroup, IconButton, Link, Td, Tr } from "@chakra-ui/react";
import { Link as RouterLink, useLocation } from "react-router-dom";

import { getTorrentMagnetLink, getTorrentSize, getTorrentTitle } from "../../../helpers/nostr/torrents";
import { NostrEvent } from "../../../types/nostr-event";
import Timestamp from "../../../components/timestamp";
import UserLink from "../../../components/user/user-link";
import Magnet from "../../../components/icons/magnet";
import { getSharableEventAddress } from "../../../helpers/nip19";
import { useRegisterIntersectionEntity } from "../../../providers/local/intersection-observer";
import { getEventUID } from "../../../helpers/nostr/event";
import { formatBytes } from "../../../helpers/number";
import TorrentMenu from "./torrent-menu";
import NoteZapButton from "../../../components/note/note-zap-button";

type DisplayCategory = { name: string; tags: string[] };

function TorrentTableRow({ torrent }: { torrent: NostrEvent }) {
  const ref = useRef<HTMLTableRowElement | null>(null);
  useRegisterIntersectionEntity(ref, getEventUID(torrent));

  const magnetLink = useMemo(() => getTorrentMagnetLink(torrent), [torrent]);

  const categories: DisplayCategory[] = [];
  const chain: string[] = [];
  for (const tag of torrent.tags) {
    if (tag[0] !== "t") continue;
    const name = tag[1];
    chain.push(tag[1]);
    categories.push({ name, tags: Array.from(chain) });
  }

  const location = useLocation();
  const createTagLink = (c: DisplayCategory) => {
    if (location.pathname.startsWith("/torrents")) {
      const params = new URLSearchParams(location.search);
      params.set("tags", c.tags.join(","));
      return `/torrents?` + params.toString();
    }
    return `/torrents?tags=${c.tags.join(",")}`;
  };

  return (
    <Tr ref={ref}>
      <Td>
        {categories
          .map((c) => (
            <Link as={RouterLink} to={createTagLink(c)}>
              {c.name}
            </Link>
          ))
          .map((el, i, arr) => (
            <>
              {el}
              {i !== arr.length - 1 && <span key={String(i) + "-div"}>{" > "}</span>}
            </>
          ))}
      </Td>
      <Td>
        <Link as={RouterLink} to={`/torrents/${getSharableEventAddress(torrent)}`} isTruncated maxW="lg">
          {getTorrentTitle(torrent)}
        </Link>
      </Td>
      <Td>
        <Timestamp timestamp={torrent.created_at} />
      </Td>
      <Td>{formatBytes(getTorrentSize(torrent))}</Td>
      <Td>
        <UserLink pubkey={torrent.pubkey} tab="torrents" />
      </Td>
      <Td isNumeric>
        <ButtonGroup variant="ghost" size="xs">
          <NoteZapButton event={torrent} />
          <IconButton as={Link} icon={<Magnet />} aria-label="Magnet URI" isExternal href={magnetLink} />
          <TorrentMenu torrent={torrent} aria-label="More Options" ml="auto" />
        </ButtonGroup>
      </Td>
    </Tr>
  );
}
export default memo(TorrentTableRow);
