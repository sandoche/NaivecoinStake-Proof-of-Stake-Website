---
layout: post
title:  "06. Wallet UI and blockchain explorer"
date:   2018-08-04 14:00:10 +0200
categories: blockchain proof-of-stake cryptocurrency pos
author: Sandoche ADITTANE
---

## Overview
In this chapter we will add an UI for the wallet and create blockchain explorer for our blockchain. Our node already exposes its functionalities with HTTP endpoints, so we will create a web page that makes requests to those endpoints and visualizes the results.

To achieve all this, we must add some additional endpoints and logic your node, for instance:

* Query information about blocks and transactions
* Query information about a specific address

This chapter has been copied from the original [Naivecoin tutorial](https://lhartikk.github.io) made by [Lauri Hartikka](https://github.com/lhartikk) and adapted for the Proof of Stake consensus. See the original page here: [https://lhartikk.github.io/jekyll/update/2017/07/09/chapter6.html](https://lhartikk.github.io/jekyll/update/2017/07/09/chapter6.html)

## New endpoints
Let’s add an endpoint from which the user can query a specific block, if the hash is known.
``` ts
    app.get('/block/:hash', (req, res) => {
        const block = _.find(getBlockchain(), {'hash' : req.params.hash});
        res.send(block);
    });
``` 
The same goes for querying a specific transaction:
``` ts
    app.get('/transaction/:id', (req, res) => {
        const tx = _(getBlockchain())
            .map((blocks) => blocks.data)
            .flatten()
            .find({'id': req.params.id});
        res.send(tx);
    });
```
We would also like to show information about a specific address. For now we return the list of unspent outputs for that address, as from this information we can e.g. calculate the total balance for that address.
``` ts
    app.get('/address/:address', (req, res) => {
        const unspentTxOuts: UnspentTxOut[] =
            _.filter(getUnspentTxOuts(), (uTxO) => uTxO.address === req.params.address)
        res.send({'unspentTxOuts': unspentTxOuts});
    });
```
We could also add information about spent transaction outputs for a given address in order to visualize full history of a given address.

## Frontend techs
We will use Vue.js to implement the UI parts of the wallet and the blockchain explorer. Since this tutorial is not about frontend development, we will not walk through the frontent part in terms of code. The repository for the UI code can be found here.

## Blockchain explorer
Blockchain explorer is a website which is used to visualize the state of the blockchain. A typical use case for a blockchain explorer is to easily check the balance of a given address or verify that a given transaction is included to the blockchain.

In our case we simply make a http requests to the node and show the responses in a some meaningful way. We never make any request that modifys the state of the blockchain, so building a blockchain explorer is all about visualizing the information the node provides in a meaningful way.

A screenshot from the blockchain explorer:

![Wallet UI](/assets/images/explorer_ui.png)

## Wallet UI
For the wallet UI we will also create a similar website as in the case of blockchain explorer. The user should be able to send coins and view the balance of address. We will also show the transaction pool.

A screenshot from the wallet:

![Wallet UI](/assets/images/wallet_ui.png)