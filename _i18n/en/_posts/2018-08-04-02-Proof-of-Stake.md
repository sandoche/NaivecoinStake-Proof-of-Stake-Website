---
layout: post
title:  "02. Proof of Stake"
date:   2018-08-04 14:00:50 +0200
categories: blockchain proof-of-stake cryptocurrency pos
author: Sandoche ADITTANE
---

// Work in progress

## Overview

In this chapter we will implement the consensus to decide in a distributed way what are the block that should be next in the blockchain. There are many different consensuses to achieve this goal using different rules ([read more here](https://medium.com/learning-lab/proof-of-what-understand-the-distributed-consensuses-in-blockchain-1d9304ae4afe)). The two most famous consensuses are Proof of Work (PoW) and Proof of Stake (PoS).

With Proof of Work the more computationnal power your node have the more chance you have to find the next block, nodes have to calculates a lot of hashes to find a block. This process is called mining and uses a lot of electricity. In order to avoid such a waste, Peercoin introduced the Proof of Stake consensus that gives more chance to find a block to the nodes that holds more coins. This process is called minting. The Proof of Stake algorithm implemented here are based on this article: [https://blog.ethereum.org/2014/07/05/stake/](https://blog.ethereum.org/2014/07/05/stake/) from Vitalik Buterin. Also, keep in mind that there are many different implementation of Proof of Stake.

This chapter also shows how to control the block generation interval by changing the difficulty. 

It should be noted that we do not yet introduce transactions in this chapter. This means there is actually no incentive for the miners to generate a block. Generally in cryptocurrencies, the node is rewarded for finding a block, but this is not the case yet in our blockchain.

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
                timestamp: number, data: Transaction[], difficulty: number, nonce: number, minterBalance: number, minterAddress: string) {
        this.index = index;
        this.previousHash = previousHash;
        this.timestamp = timestamp;
        this.data = data;
        this.hash = hash;
        this.difficulty = difficulty;
        this.nonce = nonce;
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
    let nonce = 0;
    let pastTimestamp: number = 0;
    while (true) {
        let timestamp: number = getCurrentTimestamp();
        // Since the nonce it's not changing we should calculate the hash only each second
        if(pastTimestamp !== timestamp) {
            let hash: string = calculateHash(index, previousHash, timestamp, data, difficulty, getAccountBalance(), getPublicFromWallet());
            if (isBlockStakingValid(previousHash, getPublicFromWallet(), timestamp, getAccountBalance(), difficulty, index)) {
                return new Block(index, hash, previousHash, timestamp, data, difficulty, nonce, getAccountBalance(), getPublicFromWallet());
            }
            pastTimestamp = timestamp;
            nonce++;
        }
    }
};
```

## Consensus on the difficulty

## Timestamp validation

## Cumulative difficulty



## Conclusions

[Next (Transactions) >>](/03-Transactions)