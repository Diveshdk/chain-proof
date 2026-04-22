import CopyrightRegistryABI from '../../../shared/abi/CopyrightRegistry.json';
import DisputeDAOABI from '../../../shared/abi/DisputeDAO.json';
import GovernanceTokenABI from '../../../shared/abi/GovernanceToken.json';
import { contracts as addresses, network } from '../../../shared/contractAddresses';

export const CONTRACT_CONFIG = {
  address: addresses.copyrightRegistry as `0x${string}`,
  abi: CopyrightRegistryABI.abi,
  governanceToken: {
    address: addresses.governanceToken as `0x${string}`,
    abi: GovernanceTokenABI.abi,
  },
  disputeDAO: {
    address: addresses.disputeDAO as `0x${string}`,
    abi: DisputeDAOABI.abi,
  },
  network: network,
};

export const UI_CONFIG = {
  explorerUrl: network.blockExplorer,
  rpcUrl: network.rpcUrl,
  chainId: network.chainId,
};
