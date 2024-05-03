import {
  Flex,
  FormControl,
  FormLabel,
  AccordionItem,
  AccordionPanel,
  AccordionButton,
  Box,
  AccordionIcon,
  FormHelperText,
  Input,
  FormErrorMessage,
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
} from "@chakra-ui/react";
import { ECashIcon } from "../../components/icons";
import { useFormContext } from "react-hook-form";
import { AppSettings } from "../../services/settings/migrations";
import { useEffect, useState } from "react";
import { CashuMint, CashuWallet, MintQuoteResponse } from "@cashu/cashu-ts";
import useCashu from "../../hooks/use-cashu";

interface MintTokensModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function MintTokensModal({ isOpen, onClose }: MintTokensModalProps) {
  const [mintAmount, setMintAmount] = useState<string>("0");
  const [mintQuote, setMintQuote] = useState<MintQuoteResponse>();

  const { addProofsToBalance } = useCashu();

  const handleGetMintQuote = async () => {
    const keyset = JSON.parse(localStorage.getItem("cashu.keyset") || "{}");

    if (!keyset) {
      alert("No keyset found. Add a mint first");
      return;
    }

    const wallet = new CashuWallet(new CashuMint(keyset.mintUrl), {
      keys: keyset,
    });

    const mintQuoteRes = await wallet.getMintQuote(Number(mintAmount));

    console.log("Quote", mintQuoteRes.quote);
    console.log("Request", mintQuoteRes.request);

    setMintQuote(mintQuoteRes);
  };

  const handleMintTokens = async () => {
    if (!mintQuote) alert("Start mint first");

    const keyset = JSON.parse(localStorage.getItem("cashu.keyset") || "{}");

    if (!keyset) {
      alert("No keyset found. Add a mint first");
      return;
    }

    const wallet = new CashuWallet(new CashuMint(keyset.mintUrl), {
      keys: keyset,
    });

    const { proofs } = await wallet.mintTokens(Number(mintAmount), mintQuote!.quote);

    addProofsToBalance(proofs);

    setMintQuote(undefined);
    setMintAmount("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalCloseButton />
        <ModalHeader px="4" pb="0" pt="4">
          Mint Tokens
        </ModalHeader>
        <ModalBody>
          <Input
            placeholder="Amount to Mint"
            type="number"
            w="full"
            size="lg"
            onChange={(e) => setMintAmount(e.target.value)}
          />
          <Button
            ml="auto"
            mt={2}
            // isLoading={form.formState.isLoading || form.formState.isValidating || form.formState.isSubmitting}
            // isDisabled={!form.formState.isDirty}
            colorScheme="primary"
            onClick={handleGetMintQuote}
          >
            Request Invoice
          </Button>
          {mintQuote && (
            <>
              <div>
                <h3>Pay This</h3>
                <p>{mintQuote.request}</p>
              </div>
              <Button
                ml="auto"
                mt={2}
                // isLoading={form.formState.isLoading || form.formState.isValidating || form.formState.isSubmitting}
                // isDisabled={!form.formState.isDirty}
                colorScheme="primary"
                onClick={handleMintTokens}
              >
                I Paid It
              </Button>
            </>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

const Balance = () => {
  const [balance, setBalance] = useState(0);
  const { getBalance } = useCashu();

  useEffect(() => {
    setBalance(getBalance());

    const interval = setInterval(() => {
      setBalance(getBalance());
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h1>Balance {balance} eSats</h1>
    </div>
  );
};

export default function CashuSettings() {
  const { register, formState } = useFormContext<AppSettings>();

  const [mintUrl, setMintUrl] = useState<string>("");
  const [fetchingMint, setFetchingMint] = useState<boolean>(false);
  const [showMintModal, setShowMintModal] = useState<boolean>(false);

  const handleAddMint = async (e: any) => {
    e.preventDefault();

    setFetchingMint(true);

    try {
      const mint = new CashuMint(mintUrl);

      const { keysets } = await mint.getKeys();

      console.log("Keysets", keysets);

      if (keysets.length === 0) {
        alert("No keysets found for this mint.");
        return;
      }

      const keyset = keysets[0];

      localStorage.setItem("cashu.keyset", JSON.stringify({ ...keyset, mintUrl }));
    } catch (e) {
      console.error("Error adding mint", e);
      alert("Error adding mint");
    }

    setFetchingMint(false);
  };

  useEffect(() => {
    const currentKeys = JSON.parse(localStorage.getItem("cashu.keyset") || "{}");

    if (currentKeys.mintUrl) {
      setMintUrl(currentKeys.mintUrl);
    }
  }, []);

  return (
    <AccordionItem>
      <h2>
        <AccordionButton fontSize="xl">
          <ECashIcon mr="2" />
          <Box as="span" flex="1" textAlign="left">
            Cashu
          </Box>
          <AccordionIcon />
        </AccordionButton>
      </h2>
      <AccordionPanel>
        <Flex direction="column" gap="4">
          <Balance />
          <FormControl isInvalid={!!formState.errors.twitterRedirect}>
            <FormLabel>Cashu Mint</FormLabel>
            <Input
              type="url"
              placeholder="https://mint.example.com/"
              value={mintUrl}
              onChange={(e) => setMintUrl(e.target.value)}
              // {...register("twitterRedirect", { setValueAs: safeUrl })}
            />
            {formState.errors.twitterRedirect && (
              <FormErrorMessage>{formState.errors.twitterRedirect.message}</FormErrorMessage>
            )}
            <FormHelperText>Cashu mints allow you to hold tokens in exchange for lightning. </FormHelperText>
            <Button
              ml="auto"
              mt="2"
              isLoading={fetchingMint}
              // isDisabled={!form.formState.isDirty}
              colorScheme="primary"
              type="submit"
              onClick={(e) => handleAddMint(e)}
            >
              Add Mint
            </Button>
          </FormControl>
          <FormControl isInvalid={!!formState.errors.twitterRedirect}>
            <FormLabel>Increase Balance</FormLabel>
            <Button
              ml="auto"
              mt={2}
              // isLoading={form.formState.isLoading || form.formState.isValidating || form.formState.isSubmitting}
              // isDisabled={!form.formState.isDirty}
              colorScheme="primary"
              onClick={() => setShowMintModal(true)}
            >
              Mint Tokens
            </Button>
          </FormControl>
        </Flex>
      </AccordionPanel>
      <MintTokensModal isOpen={showMintModal} onClose={() => setShowMintModal(false)} />
    </AccordionItem>
  );
}
