---
layout: post
title:  "05. Transaction relaying"
date:   2018-08-04 14:00:20 +0200
categories: blockchain proof-of-stake cryptocurrency pos
author: Sandoche ADITTANE
---

## Overview
In this chapter we will implement the relaying of such transactions, that are not yet included in the blockchain. In bitcoin, these transaction are also known as “unconfirmed transactions”. Typically, when someone wants to include a transaction to the blockchain (= send coins to some address ) he broadcasts the transaction to the network and hopefully some node will mint the transaction to the blockchain.

This feature is very important for a working cryptocurrency, since it means you don’t need to mint a block yourself, in order to include a transaction to the blockchain.

As a consequence, the nodes will now share two types of data when they communicate with each other:

* the state of the blockchain ( =the blocks and transactions that are included to the blockchain)
* unconfirmed transactions ( =the transactions that are not yet included in the blockchain)

This chapter has been copied from the original [Naivecoin tutorial](https://lhartikk.github.io) made by [Lauri Hartikka](https://github.com/lhartikk) and adapted for the Proof of Stake consensus. See the original page here: [https://lhartikk.github.io/jekyll/update/2017/07/10/chapter5.html](https://lhartikk.github.io/jekyll/update/2017/07/10/chapter5.html)

## Transaction pool
We will store our unconfirmed transactions in a new entity called “transaction pool” (also known as “mempool” in bitcoin). Transaction pool is a structure that contains all of the “unconfirmed transactions” our node know of. In this simple implementation we will just use a list.
``` ts
let transactionPool: Transaction[] = [];
```

We will also introduce a new endpoint to our node: POST /sendTransaction. This method creates the a transaction to our local transaction pool based on the existing wallet functionality. For now on we will use this method as the “preferred” interface when we want to include a new transaction to the blockchain.
``` ts
    app.post('/sendTransaction', (req, res) => {
        ...
    })
```
We create the transaction just like we did in chapter4. We just add the created transaction to the pool instead of instantly trying to mint a block:
``` ts
const sendTransaction = (address: string, amount: number): Transaction => {
    const tx: Transaction = createTransaction(address, amount, getPrivateFromWallet(), getUnspentTxOuts(), getTransactionPool());
    addToTransactionPool(tx, getUnspentTxOuts());
    return tx;
};
```
## Broadcasting
The whole point of the unconfirmed transactions are that they will spread throughout the network and eventually some node will mint the transaction to the blockchain. To handle this we will introduce the following simple rules for the networking of unconfirmed transactions:

* When a node receives an unconfirmed transaction it has not seen before, it will broadcast the full transaction pool to all peers.
* When a node first connects to another node, it will query for the transaction pool of that node.
We will add two new MessageTypes to serve this purpose: `QUERY_TRANSACTION_POOL` and `RESPONSE_TRANSACTION_POOL`. 

The MessageType enum will now look now like this:
``` ts
enum MessageType {
    QUERY_LATEST = 0,
    QUERY_ALL = 1,
    RESPONSE_BLOCKCHAIN = 2,
    QUERY_TRANSACTION_POOL = 3,
    RESPONSE_TRANSACTION_POOL = 4
}
```

The transaction pool messages will be created in the following way:

``` ts
const responseTransactionPoolMsg = (): Message => ({
    'type': MessageType.RESPONSE_TRANSACTION_POOL,
    'data': JSON.stringify(getTransactionPool())
}); 

const queryTransactionPoolMsg = (): Message => ({
    'type': MessageType.QUERY_TRANSACTION_POOL,
    'data': null
});
```

To implement the described transaction broadcasting logic, we add code to handle the `MessageType.RESPONSE_TRANSACTION_POOL` message type. Whenever, we receive unconfirmed transactions, we try to add those to our transaction pool. If we manage to add a transaction to our pool, it means that the transaction is valid and our node has not seen the transaction before. In this case we broadcast our own transaction pool to all peers.

``` ts
case MessageType.RESPONSE_TRANSACTION_POOL:
    const receivedTransactions: Transaction[] = JSONToObject<Transaction[]>(message.data);
    receivedTransactions.forEach((transaction: Transaction) => {
        try {
            handleReceivedTransaction(transaction);
            //if no error is thrown, transaction was indeed added to the pool
            //let's broadcast transaction pool
            broadCastTransactionPool();
        } catch (e) {
            //unconfirmed transaction not valid (we probably already have it in our pool)
        }
    });
```

## Validating received unconfirmed transactions
As the peers can send us any kind of transactions, we must validate the transactions before we can add them to the transaction pool. All of the existing transaction validation rules apply. For instance, the transaction must be correctly formatted, and the transaction inputs, outputs and signatures must match.

In addition to the existing rules, we add a new rule: a transaction cannot be added to the pool if any of the transaction inputs are already found in the existing transaction pool. This new rule is embodied in the following code:
``` ts
const isValidTxForPool = (tx: Transaction, aTtransactionPool: Transaction[]): boolean => {
    const txPoolIns: TxIn[] = getTxPoolIns(aTtransactionPool);

    const containsTxIn = (txIns: TxIn[], txIn: TxIn) => {
        return _.find(txPoolIns, (txPoolIn => {
            return txIn.txOutIndex === txPoolIn.txOutIndex && txIn.txOutId === txPoolIn.txOutId;
        }))
    };

    for (const txIn of tx.txIns) {
        if (containsTxIn(txPoolIns, txIn)) {
            console.log('txIn already found in the txPool');
            return false;
        }
    }
    return true;
};
```
There is no explicit way to remove a transaction from the transaction pool. The transaction pool will however be updated each time a new block is found.

## From transaction pool to blockchain
Let’s next implement a way for the unconfirmed transaction to find its way from the local transaction pool to a block minted by the same node. This is simple: when a node starts to mint a block, it will include the transactions from the transaction pool to the new block candidate.
``` ts
const generateNextBlock = () => {
    const coinbaseTx: Transaction = getCoinbaseTransaction(getPublicFromWallet(), getLatestBlock().index + 1);
    const blockData: Transaction[] = [coinbaseTx].concat(getTransactionPool());
    return generateRawNextBlock(blockData);
};
```
As the transactions are already validated, before they are added to the pool, we are not doing any further validations at this points.

## Updating the transaction pool
As new blocks with transactions are minted to the blockchain, we must revalidate the transaction pool every time a new block is found. It is possible that the new block contains transactions that makes some of the transactions in the pool invalid. This can happen if for instance:

* The transaction that was in the pool was minted (by the node itself or by someone else)
* The unspent transaction output that is referred in the unconfirmed transaction is spent by some other transaction

The transaction pool will be updated with the following code:
``` ts
const updateTransactionPool = (unspentTxOuts: UnspentTxOut[]) => {
    const invalidTxs = [];
    for (const tx of transactionPool) {
        for (const txIn of tx.txIns) {
            if (!hasTxIn(txIn, unspentTxOuts)) {
                invalidTxs.push(tx);
                break;
            }
        }
    }
    if (invalidTxs.length > 0) {
        console.log('removing the following transactions from txPool: %s', JSON.stringify(invalidTxs));
        transactionPool = _.without(transactionPool, ...invalidTxs)
    }
};
```
As it can be seen, we need to know only the current unspent transaction outputs to make the decision if a transaction should be removed from the pool.

## Conclusions
We can now include transactions to the blockchain without actually having to mint the blocks themselves. There is however no incentive for the nodes to include a received transaction to the block as we did not implement the concept of transaction fees.

Find the full source code here: [https://github.com/sandoche/NaivecoinStake-Proof-of-Stake-Core](https://github.com/sandoche/NaivecoinStake-Proof-of-Stake-Core)

[Next (Wallet UI and blockchain explorer) >>](/06-Wallet-UI-blockchain-explorer/)