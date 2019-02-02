---
layout: post
title:  "02. Proof of Stake"
date:   2018-08-04 14:00:50 +0200
categories: blockchain proof-of-stake cryptocurrency pos
author: Sandoche ADITTANE
---

## Overview

In this chapter we will implement the consensus to decide in a distributed way what are the block that should be next in the blockchain. There are many different consensuses to achieve this goal using different rules ([read more here](https://medium.com/learning-lab/proof-of-what-understand-the-distributed-consensuses-in-blockchain-1d9304ae4afe)). The two most famous consensuses are Proof of Work (PoW) and Proof of Stake (PoS).

With Proof of Work the more computationnal power your node have the more chance you have to find the next block, nodes have to calculates a lot of hashes to find a block. This process is called mining and uses a lot of electricity. In order to avoid such a waste, Peercoin introduced the Proof of Stake consensus that gives more chance to find a block to the nodes that holds more coins. This process is called minting. The Proof of Stake algorithm implemented here are based on this article: [https://blog.ethereum.org/2014/07/05/stake/](https://blog.ethereum.org/2014/07/05/stake/) from Vitalik Buterin. Also, keep in mind that there are many different implementation of Proof of Stake.

This chapter also shows how to control the block generation interval by changing the difficulty. 

It should be noted that we do not yet introduce transactions in this chapter. This means there is actually no incentive for the minters to generate a block. Generally in cryptocurrencies, the node is rewarded for finding a block, but this is not the case yet in our blockchain.

If you are looking for the implementation of Proof of Work consensus we recommend you to read the original Naivecoin tutorial: [https://lhartikk.github.io/jekyll/update/2017/07/13/chapter2.html](https://lhartikk.github.io/jekyll/update/2017/07/13/chapter2.html).

## Difficulty and Proof of Stake Puzzle

We will add three proprieties to the block structure:
* `difficulty` a number that will be used to keep the time interval between each block the same
* `minterBalance` the balance of the node who is minting (finding a block)
* `minterAddress` the address of the node who is minting (finding a block)

Note that the `minterBalance` and `minterAddress` has been added to simplify the code, but it can be removed using the coinbase information (for the `minterAddress`) and the UnspentOutput at a specific block number can and should be used to calculate the `minterBalance`.

Here is the current block structure:
``` ts
class Block {

    public index: number;
    public hash: string;
    public previousHash: string;
    public timestamp: number;
    public data: Transaction[];
    public difficulty: number;
    public nonce: number;
    public minterBalance: number; // hack to avoid recaculating the balance of the minter at a precise height
    public minterAddress: string;

    constructor(index: number, hash: string, previousHash: string,
                timestamp: number, data: Transaction[], difficulty: number, minterBalance: number, minterAddress: string) {
        this.index = index;
        this.previousHash = previousHash;
        this.timestamp = timestamp;
        this.data = data;
        this.hash = hash;
        this.difficulty = difficulty;
        this.minterBalance = minterBalance;
        this.minterAddress = minterAddress;
    }
}
```

Also, the calculation of the hash needs to be updated with the new data:
``` ts
const calculateHash = (index: number, previousHash: string, timestamp: number, data: Transaction[],
                       difficulty: number, minterBalance: number, minterAddress: string): string =>
    CryptoJS.SHA256(index + previousHash + timestamp + data + difficulty + minterBalance + minterAddress).toString();
```

Now let's see the Proof of Stake puzzle that is used to decide if a block is found in pseudo code from Vitalik Buterin: [https://blog.ethereum.org/2014/07/05/stake/](https://blog.ethereum.org/2014/07/05/stake/)
``` js
SHA256(prevhash + address + timestamp) <= 2^256 * balance / diff
```

And below the implementation of it in Typescript
``` ts
const isBlockStakingValid = (prevhash: string, address: string, timestamp: number, balance: number, difficulty: number, index: number): boolean => {
    difficulty = difficulty + 1;
    
    // Allow minting without coins for a few blocks
    if(index <= mintingWithoutCoinIndex) {
        balance = balance + 1;
    }
    
    const balanceOverDifficulty = new BigNumber(2).exponentiatedBy(256).times(balance).dividedBy(difficulty);
    const stakingHash: string = CryptoJS.SHA256(prevhash + address + timestamp);
    const decimalStakingHash = new BigNumber(stakingHash, 16);
    const difference = balanceOverDifficulty.minus(decimalStakingHash).toNumber();

    return difference >= 0;
};
```

Since the puzzle compares very big number, we need to use a library that can handle these numbers

Also, as you can see the `SHA256()` function takes the `prevhash` that cannot change, the `address` that cannot change withotu changing the `balance` and the `timestamp` that changes only every second, that is why you can try to find a block every second which makes it consumming a lot less energy than proof of work.

Note that Proof of Stake has one big limitation: when you start the blockchain with every account has 0 coins, no one would be able to stake it's coin and find a block. There are different ways to solve this problem:
* Generate an amount of coins in the genesis block and distribute them manually to the nodes (or sell them)
* Use Proof of Stake consensus along with Proof of Work to give chance to the accounts without coins to succeed
* Simulate an increment of the balance in a limited number of blocks (what we can see in the code above)

Also, note that it's still possible for nodes to cheat by changing the timestamp. In order to avoid that some cryptocurrency adds checkpoints (which are centralized and sent by an authority).

## Finding a block

As describe above, to find a block we need to try the puzzle every second. It is done with by the following code:
``` ts
const findBlock = (index: number, previousHash: string, data: Transaction[], difficulty: number): Block => {
    let pastTimestamp: number = 0;
    while (true) {
        let timestamp: number = getCurrentTimestamp();
        if(pastTimestamp !== timestamp) {
            let hash: string = calculateHash(index, previousHash, timestamp, data, difficulty, getAccountBalance(), getPublicFromWallet());
            if (isBlockStakingValid(previousHash, getPublicFromWallet(), timestamp, getAccountBalance(), difficulty, index)) {
                return new Block(index, hash, previousHash, timestamp, data, difficulty, getAccountBalance(), getPublicFromWallet());
            }
            pastTimestamp = timestamp;
        }
    }
};
```

## Consensus on the difficulty
We have now the means to find and verify the hash for a given difficulty, but how is the difficulty determined? There must be a way for the nodes to agree what the current difficulty is. For this we introduce some new rules that we use to calculate the current difficulty of the network.

Lets define the following new constants for the network:

* `BLOCK_GENERATION_INTERVAL`, defines how often a block should be found. (in Bitcoin this value is 10 minutes)
* `DIFFICULTY_ADJUSTMENT_INTERVAL`, defines how often the difficulty should adjust to the increasing or decreasing network hashrate. (in Bitcoin this value is 2016 blocks)

We will set the block generation interval to 10s and difficulty adjustment to 10 blocks. These constants do not change over time and they are hard coded.
``` ts
// in seconds
const BLOCK_GENERATION_INTERVAL: number = 10;

// in blocks
const DIFFICULTY_ADJUSTMENT_INTERVAL: number = 10;
```
Now we have the means to agree on a difficulty of the block. For every 10 blocks that is generated, we check if the time that took to generate those blocks are larger or smaller than the expected time. The expected time is calculated like this: `BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL`. The expected time represents the case where the hashrate matches exactly the current difficulty.

We either increase or decrease the difficulty by one if the time taken is at least two times greater or smaller than the expected difficulty. The difficulty adjustment is handled by the following code:
``` ts
const getDifficulty = (aBlockchain: Block[]): number => {
    const latestBlock: Block = aBlockchain[blockchain.length - 1];
    if (latestBlock.index % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 && latestBlock.index !== 0) {
        return getAdjustedDifficulty(latestBlock, aBlockchain);
    } else {
        return latestBlock.difficulty;
    }
};

const getAdjustedDifficulty = (latestBlock: Block, aBlockchain: Block[]) => {
    const prevAdjustmentBlock: Block = aBlockchain[blockchain.length - DIFFICULTY_ADJUSTMENT_INTERVAL];
    const timeExpected: number = BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL;
    const timeTaken: number = latestBlock.timestamp - prevAdjustmentBlock.timestamp;
    if (timeTaken < timeExpected / 2) {
        return prevAdjustmentBlock.difficulty + 1;
    } else if (timeTaken > timeExpected * 2) {
        return prevAdjustmentBlock.difficulty - 1;
    } else {
        return prevAdjustmentBlock.difficulty;
    }
};
```

## Timestamp validation
In the chapter1 version of the blockchain, the timestamp did not have any role nor validation. In fact it could be anything the client decided to generate. This changes now that the difficulty adjustment is introduced as the timeTaken variable (in the previous code snippet) is calculated based on the timestamps of the blocks.

To mitigate the attack where a false timestamp is introduced in order to manipulate the difficulty the following rules is introduced:

A block is valid, if the timestamp is at most 1 min in the future from the time we perceive.
A block in the chain is valid, if the timestamp is at most 1 min in the past of the previous block.

```
const isValidTimestamp = (newBlock: Block, previousBlock: Block): boolean => {
    return ( previousBlock.timestamp - 60 < newBlock.timestamp )
        && newBlock.timestamp - 60 < getCurrentTimestamp();
};
```

## Cumulative difficulty
In the chapter1 version of the blockchain, we chose always the “longest” blockchain to be the valid. This must change now that difficulty is introduced. For now on the “correct” chain is not the “longest” chain, but the chain with the most cumulative difficulty. In other words, the correct chain is the chain which required most resources (= hashRate * time) to produce.

To get the cumulative difficulty of a chain we calculate 2^difficulty for each block and take a sum of all those numbers. We have to use the 2^difficulty as we chose the difficulty to represent the number of zeros that must prefix the hash in binary format. For instance, if we compare the difficulties of 5 and 11, it requires 2^(11-5) = 2^6 times more work to find a block with latter difficulty.

This property is also known as “Nakamoto consensus” and it is one of the most important inventions Satoshi made, when s/he invented Bitcoin. In case of forks, minters must choose on which chain the they decide put their current resources (= hashRate). As it is in the interest of the minters to produce such block that will be included in the blockchain, the minters are incentivized to eventually to choose the same chain.


## Conclusions
The Proof of Stake consensus is a quite interesting alternative to the Proof of Work since it doesn't use as much energy. Also there are different attacks that can be done, such as changing the timestamp against what this naivecoin is not protecting against.

Also, in the current implementation, the account balance is not calculated based on the blockchain but written and read from the chain itself (for simplification purpose since I was mostly interested about the puzzle itself). It is not good at all and should be solved!

[Next (Transactions) >>](/03-Transactions/)