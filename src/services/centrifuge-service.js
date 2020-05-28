import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import config from '../config/config';
import { BN } from 'bn.js';
import * as ErrorStatus from '../constants/error-status';

const url = config.CFG_NETOWRK_URL;
const transfer_amount = config.CFG_TRANSFER_AMOUNT;

let pk = null;

const getConnection = async () => {
  const provider = new WsProvider(url);

  const api = await ApiPromise.create({
    provider,
    types: {
      // mapping the actual specified address format
      Address: 'AccountId',
      // mapping the lookup
      LookupSource: 'AccountId'
    }
  });

  return api;
};

const startup = async () => {
  await cryptoWaitReady();
  const keyring = new Keyring();

  pk = keyring.addFromUri(config.CFG_HOT_WALLET_SEED, {}, 'sr25519');
};

startup();

const hasFunds = async (api) => {
  const { balanceBN } = await walletBalance(api);
  const transferBN = new BN(transfer_amount);
  const requiredAmountBN = transferBN.div(new BN(100)).mul(new BN(110)); // need 10% more

  if (balanceBN.lt(requiredAmountBN))
    throw new Error(ErrorStatus.INSUFFICIENT_FUNDS);
};

export const transfer = async (recipient_address) => {
  const api = await getConnection();

  try {
    await hasFunds();
    const hash = await api.tx.balances
      .transfer(recipient_address, transfer_amount)
      .signAndSend(pk);

    return hash;
  } finally {
    await api.disconnect();
  }
};

export const walletBalance = async (api) => {
  let currentApi = null;
  let disconnect = true;
  if (api == null) {
    currentApi = await getConnection();
    disconnect = true; // remember to disconnect
  } else {
    currentApi = api;
    disconnect = false; // caller will disconnect
  }

  try {
    const {
      data: { free: previousFree }
    } = await currentApi.query.system.account(pk.address);
    return { balance: previousFree.toHuman(), balanceBN: previousFree };
  } finally {
    if (disconnect === true) {
      await currentApi.disconnect();
    }
  }
};
