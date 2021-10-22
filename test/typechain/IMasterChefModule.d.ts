/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import {
  ethers,
  EventFilter,
  Signer,
  BigNumber,
  BigNumberish,
  PopulatedTransaction,
  BaseContract,
  ContractTransaction,
  CallOverrides,
} from "ethers";
import { BytesLike } from "@ethersproject/bytes";
import { Listener, Provider } from "@ethersproject/providers";
import { FunctionFragment, EventFragment, Result } from "@ethersproject/abi";
import type { TypedEventFilter, TypedEvent, TypedListener } from "./common";

interface IMasterChefModuleInterface extends ethers.utils.Interface {
  functions: {
    "masterChef()": FunctionFragment;
    "rewardPoolInfo(uint256)": FunctionFragment;
    "sushi()": FunctionFragment;
  };

  encodeFunctionData(
    functionFragment: "masterChef",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "rewardPoolInfo",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(functionFragment: "sushi", values?: undefined): string;

  decodeFunctionResult(functionFragment: "masterChef", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "rewardPoolInfo",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "sushi", data: BytesLike): Result;

  events: {};
}

export class IMasterChefModule extends BaseContract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  listeners<EventArgsArray extends Array<any>, EventArgsObject>(
    eventFilter?: TypedEventFilter<EventArgsArray, EventArgsObject>
  ): Array<TypedListener<EventArgsArray, EventArgsObject>>;
  off<EventArgsArray extends Array<any>, EventArgsObject>(
    eventFilter: TypedEventFilter<EventArgsArray, EventArgsObject>,
    listener: TypedListener<EventArgsArray, EventArgsObject>
  ): this;
  on<EventArgsArray extends Array<any>, EventArgsObject>(
    eventFilter: TypedEventFilter<EventArgsArray, EventArgsObject>,
    listener: TypedListener<EventArgsArray, EventArgsObject>
  ): this;
  once<EventArgsArray extends Array<any>, EventArgsObject>(
    eventFilter: TypedEventFilter<EventArgsArray, EventArgsObject>,
    listener: TypedListener<EventArgsArray, EventArgsObject>
  ): this;
  removeListener<EventArgsArray extends Array<any>, EventArgsObject>(
    eventFilter: TypedEventFilter<EventArgsArray, EventArgsObject>,
    listener: TypedListener<EventArgsArray, EventArgsObject>
  ): this;
  removeAllListeners<EventArgsArray extends Array<any>, EventArgsObject>(
    eventFilter: TypedEventFilter<EventArgsArray, EventArgsObject>
  ): this;

  listeners(eventName?: string): Array<Listener>;
  off(eventName: string, listener: Listener): this;
  on(eventName: string, listener: Listener): this;
  once(eventName: string, listener: Listener): this;
  removeListener(eventName: string, listener: Listener): this;
  removeAllListeners(eventName?: string): this;

  queryFilter<EventArgsArray extends Array<any>, EventArgsObject>(
    event: TypedEventFilter<EventArgsArray, EventArgsObject>,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TypedEvent<EventArgsArray & EventArgsObject>>>;

  interface: IMasterChefModuleInterface;

  functions: {
    masterChef(overrides?: CallOverrides): Promise<[string]>;

    rewardPoolInfo(
      pid: BigNumberish,
      overrides?: CallOverrides
    ): Promise<
      [BigNumber, BigNumber] & {
        accSushiPerShare: BigNumber;
        sushiLastRewardBlock: BigNumber;
      }
    >;

    sushi(overrides?: CallOverrides): Promise<[string]>;
  };

  masterChef(overrides?: CallOverrides): Promise<string>;

  rewardPoolInfo(
    pid: BigNumberish,
    overrides?: CallOverrides
  ): Promise<
    [BigNumber, BigNumber] & {
      accSushiPerShare: BigNumber;
      sushiLastRewardBlock: BigNumber;
    }
  >;

  sushi(overrides?: CallOverrides): Promise<string>;

  callStatic: {
    masterChef(overrides?: CallOverrides): Promise<string>;

    rewardPoolInfo(
      pid: BigNumberish,
      overrides?: CallOverrides
    ): Promise<
      [BigNumber, BigNumber] & {
        accSushiPerShare: BigNumber;
        sushiLastRewardBlock: BigNumber;
      }
    >;

    sushi(overrides?: CallOverrides): Promise<string>;
  };

  filters: {};

  estimateGas: {
    masterChef(overrides?: CallOverrides): Promise<BigNumber>;

    rewardPoolInfo(
      pid: BigNumberish,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    sushi(overrides?: CallOverrides): Promise<BigNumber>;
  };

  populateTransaction: {
    masterChef(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    rewardPoolInfo(
      pid: BigNumberish,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    sushi(overrides?: CallOverrides): Promise<PopulatedTransaction>;
  };
}
