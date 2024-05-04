import {
  IconButton,
  IconButtonProps,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalOverlay,
  useDisclosure,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Input,
  Flex,
} from "@chakra-ui/react";
import { nip19 } from "nostr-tools";

import { QrCodeIcon } from "../../../components/icons";
import QrCodeSvg from "../../../components/qr-code/qr-code-svg";
import { CopyIconButton } from "../../../components/copy-icon-button";
import { useSharableProfileId } from "../../../hooks/use-shareable-profile-id";

export const QrIconButton = ({ pubkey, ...props }: { pubkey: string } & Omit<IconButtonProps, "icon">) => {
  const { isOpen, onOpen, onClose } = useDisclosure();

  // const npub = nip19.npubEncode(pubkey);
  // const npubLink = "nostr:" + npub;
  // const nprofile = useSharableProfileId(pubkey);
  // const nprofileLink = "nostr:" + nprofile;

  // const npub = nip19.npubEncode(pubkey);
  const bolt12 = pubkey;
  console.log("npub = ", bolt12);
  const bolt12Link = "lightning:" + bolt12;
  // const bolt12Link = bolt12;
  console.log("bolt12Link = ", bolt12Link);
  // const nprofile = useSharableProfileId(pubkey);
  // console.log("nprofile = ", nprofile);
  // const nprofileLink = "nostr:" + nprofile;
  // console.log("npubLink = ", npubLink);

  return (
    <>
      <IconButton icon={<QrCodeIcon />} onClick={onOpen} {...props} />
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalBody p="2">
            <Tabs>
              <TabList>
                <Tab>bolt12</Tab>
              </TabList>

              <TabPanels>
                {/* <TabPanel p="0" pt="2">
                  <QrCodeSvg content={nprofileLink} border={2} />
                  <Flex gap="2" mt="2">
                    <Input readOnly value={nprofileLink} />
                    <CopyIconButton value={nprofileLink} aria-label="copy nprofile" />
                  </Flex>
                </TabPanel> */}
                <TabPanel p="0" pt="2">
                  <QrCodeSvg content={bolt12Link} border={2} />
                  <Flex gap="2" mt="2">
                    <Input readOnly value={bolt12Link} />
                    <CopyIconButton value={bolt12Link} aria-label="copy npub" />
                  </Flex>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </ModalBody>
          <ModalCloseButton />
        </ModalContent>
      </Modal>
    </>
  );
};
