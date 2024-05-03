import { useState } from "react";
import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  ModalProps,
} from "@chakra-ui/react";
import dayjs from "dayjs";
import { kinds } from "nostr-tools";

import { DraftNostrEvent, NostrEvent, isDTag } from "../../types/nostr-event";
import clientRelaysService from "../../services/client-relays";
import { getZapSplits } from "../../helpers/nostr/zaps";
import { unique } from "../../helpers/array";
import relayScoreboardService from "../../services/relay-scoreboard";
import { getEventCoordinate, isReplaceable } from "../../helpers/nostr/event";
import { EmbedProps } from "../embed-event";
import userMailboxesService from "../../services/user-mailboxes";
import InputStep from "./input-step";
import lnurlMetadataService from "../../services/lnurl-metadata";
import userMetadataService from "../../services/user-metadata";
import signingService from "../../services/signing";
import accountService from "../../services/account";
import PayStep from "./pay-step";
import { getInvoiceFromCallbackUrl } from "../../helpers/lnurl";
import UserLink from "../user/user-link";
import relayHintService from "../../services/event-relay-hint";
import useCashu from "../../hooks/use-cashu";

export type PayRequest = { invoice?: string; pubkey: string; error?: any };

async function getPayRequestForPubkey(
  pubkey: string,
  event: NostrEvent | undefined,
  amount: number,
  comment?: string,
  additionalRelays?: Iterable<string>,
): Promise<PayRequest> {
  const metadata = userMetadataService.getSubject(pubkey).value;
  const address = metadata?.lud16 || metadata?.lud06 || metadata?.bolt12Offer;
  if (!address) throw new Error("User missing lightning address");
  const lnurlMetadata = await lnurlMetadataService.requestMetadata(address);

  if (!lnurlMetadata) throw new Error("LNURL endpoint unreachable");

  if (amount > lnurlMetadata.maxSendable) throw new Error("Amount to large");
  if (amount < lnurlMetadata.minSendable) throw new Error("Amount to small");

  const canZap = !!lnurlMetadata.allowsNostr && !!lnurlMetadata.nostrPubkey;
  if (!canZap) {
    // build LNURL callback url
    const callback = new URL(lnurlMetadata.callback);
    callback.searchParams.append("amount", String(amount));
    if (comment) callback.searchParams.append("comment", comment);

    const invoice = await getInvoiceFromCallbackUrl(callback);

    return { invoice, pubkey };
  }

  const userInbox = relayScoreboardService
    .getRankedRelays(userMailboxesService.getMailboxes(pubkey).value?.inbox)
    .slice(0, 4);
  const eventRelays = event ? relayHintService.getEventRelayHints(event, 4) : [];
  const outbox = relayScoreboardService.getRankedRelays(clientRelaysService.outbox).slice(0, 4);
  const additional = relayScoreboardService.getRankedRelays(additionalRelays);

  // create zap request
  const zapRequest: DraftNostrEvent = {
    kind: kinds.ZapRequest,
    created_at: dayjs().unix(),
    content: comment ?? "",
    tags: [
      ["p", pubkey],
      ["relays", ...unique([...userInbox, ...eventRelays, ...outbox, ...additional])],
      ["amount", String(amount)],
    ],
  };

  // attach "e" or "a" tag
  if (event) {
    if (isReplaceable(event.kind) && event.tags.some(isDTag)) {
      zapRequest.tags.push(["a", getEventCoordinate(event)]);
    } else zapRequest.tags.push(["e", event.id]);
  }

  // TODO: move this out to a separate step so the user can choose when to sign
  const account = accountService.current.value;
  if (!account) throw new Error("No Account");
  const signed = await signingService.requestSignature(zapRequest, account);

  // build LNURL callback url
  const callback = new URL(lnurlMetadata.callback);
  callback.searchParams.append("amount", String(amount));
  callback.searchParams.append("nostr", JSON.stringify(signed));

  const invoice = await getInvoiceFromCallbackUrl(callback);

  return { invoice, pubkey };
}

async function getPayRequestsForEvent(
  event: NostrEvent,
  amount: number,
  comment?: string,
  fallbackPubkey?: string,
  additionalRelays?: Iterable<string>,
) {
  const splits = getZapSplits(event, fallbackPubkey);

  const draftZapRequests: PayRequest[] = [];
  for (const { pubkey, percent } of splits) {
    try {
      // NOTE: round to the nearest sat since there isn't support for msats yet
      const splitAmount = Math.round((amount / 1000) * percent) * 1000;
      draftZapRequests.push(await getPayRequestForPubkey(pubkey, event, splitAmount, comment, additionalRelays));
    } catch (e) {
      draftZapRequests.push({ error: e, pubkey });
    }
  }

  return draftZapRequests;
}

export type ZapModalProps = Omit<ModalProps, "children"> & {
  pubkey: string;
  event?: NostrEvent;
  relays?: string[];
  initialComment?: string;
  initialAmount?: number;
  allowComment?: boolean;
  showEmbed?: boolean;
  embedProps?: EmbedProps;
  additionalRelays?: Iterable<string>;
  onZapped: () => void;
};

export default function ZapModal({
  event,
  pubkey,
  relays,
  onClose,
  initialComment,
  initialAmount,
  allowComment = true,
  showEmbed = true,
  embedProps,
  additionalRelays = [],
  onZapped,
  ...props
}: ZapModalProps) {
  const [callbacks, setCallbacks] = useState<PayRequest[]>();

  const { getProofs, getWallet, customGetMeltQuote } = useCashu();

  const handleMeltTokens = async (amountToMelt: number, pubkey: string) => {
    const metadata = userMetadataService.getSubject(pubkey).value;
    const offer = metadata?.bolt12Offer;

    if (!offer) {
      throw new Error("No BOLT 12 Offer found");
    }

    if (!amountToMelt) {
      alert("Amount to melt is required");
      throw new Error("Amount to melt is required");
    }

    if (!offer) {
      alert("BOLT 12 Offer is required");
      throw new Error("BOLT 12 Offer is required");
    }

    const proofs = getProofs();

    const totalAmount = proofs.reduceRight((a, b) => a + b.amount, 0);

    if (totalAmount < amountToMelt) {
      alert("Not enough tokens to melt");
      throw new Error("Not enough tokens to melt");
    }

    const wallet = getWallet();

    const { send, returnChange } = await wallet.send(amountToMelt, proofs);

    window.localStorage.setItem("cashu.proofs", JSON.stringify(returnChange));

    const meltQuoteRes = await customGetMeltQuote(wallet.mint.mintUrl, {
      amount: amountToMelt,
      request: offer,
      unit: "sat",
    });

    console.log("Quote", meltQuoteRes);

    const meltTokens = await wallet.meltTokens(meltQuoteRes, send);

    console.log("Melt Tokens", meltTokens);
    return { invoice: "", pubkey };
  };

  const renderContent = () => {
    if (callbacks && callbacks.length > 0) {
      return <PayStep callbacks={callbacks} onComplete={onZapped} />;
    } else {
      return (
        <InputStep
          pubkey={pubkey}
          event={event}
          initialComment={initialComment}
          initialAmount={initialAmount}
          showEmbed={showEmbed}
          embedProps={embedProps}
          allowComment={allowComment}
          onSubmit={async (values) => {
            console.log("Submitting", values);
            const amountInMSats = values.amount * 1000;
            if (values.isNuts) {
              const localKeyset = window.localStorage.getItem("cashu.keyset");

              if (!localKeyset) {
                throw new Error("No keyset found");
              }

              const callback = await handleMeltTokens(values.amount, pubkey);

              setCallbacks([callback]);
            }
            if (event) {
              setCallbacks(
                await getPayRequestsForEvent(event, amountInMSats, values.comment, pubkey, additionalRelays),
              );
            } else {
              const callback = await getPayRequestForPubkey(
                pubkey,
                event,
                amountInMSats,
                values.comment,
                additionalRelays,
              );
              setCallbacks([callback]);
            }
          }}
        />
      );
    }
  };

  return (
    <Modal onClose={onClose} size="xl" {...props}>
      <ModalOverlay />
      <ModalContent>
        <ModalCloseButton />
        <ModalHeader px="4" pb="0" pt="4">
          {event ? (
            "Zap Event"
          ) : (
            <>
              Zap <UserLink pubkey={pubkey} fontWeight="bold" />
            </>
          )}
        </ModalHeader>
        <ModalBody padding="4">{renderContent()}</ModalBody>
      </ModalContent>
    </Modal>
  );
}
