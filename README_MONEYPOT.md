(Some rough ideas for how to explain the Moneypot ecosystem fundamentals)

### How does Moneypot work?

TODO: Describe the major concepts of controllers, users, caas, experiences.

Here's a quick recap of how the Moneypot system works.

A Moneypot casino can be summarized like this:

1. `User`s are humans that access the casino through a browser where they manage their balance and transfer money.
2. `Controller`s are bots that have programmatic API access to their own balance and they own `Experience`s.
3. `Experience`s represent games and apps with frontends that are rendered on the casino through an iframe. The casino passes their frontend a `userToken` which the experience frontend generally passes to its CAAS server, and the CAAS server exhanges it with the Moneypot casino API for a `User`'s info.

So where does `dice-controller` (our CAAS server) fit into this situation?

Let's say we're running a dice betting game as an `Experience` on some Moneypot casino.

They visit `/experience/<dice-experience-id/` on their Moneypot casino which renders our dice `Experience` in an iframe. Our dice game shows the user's balance and has a betting form with a wager field and a bet button.

For a `User` to play our experience, they first need a balance in our game. After all, they can't bet $10 of bitcoin in our game unless we have access to $10 of their money.

So the first thing they do is send some bitcoin to the `Experience` which gets deposited in the experience's `Controller`'s account which we own and have API access to.

Our CAAS server (`dice-controller`) is configured with the API key of our `Controller` at that Moneypot casino. Once our CAAS server sees that the `User` transferred money to our `Controller`, our CAAS server logs the transfer and updates the user's balance in the CAAS database.

The user can now gamble in our dice `Experience` which makes requests to our CAAS server, and our CAAS server updates the user's CAAS balance as they win and lose bets.

Once the user is ready to withdraw their money, there's a "Withdraw" button in our dice `Experience` which sends a request to our CAAS server, and or CAAS server tells the Moneypot casino to transfer that amount of money from our `Controller` to the `User`.
