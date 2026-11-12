---
slug: fake-stoic-quotes-study
title: "One in Four Top “Stoic Quotes” Pages Publishes a Fake"
description: We checked the top search results for ten ordinary Stoic quote searches. Of 144 pages we could read, 38 present a documented misattribution as genuine. Method, numbers and full dataset.
pillar: practice
published: 2026-11-12
modified: 2026-11-12
about: [{"name": "Misattributed Stoic quotations", "description": "Quotations credited to Marcus Aurelius, Seneca or Epictetus that come from a later writer or have no ancient source."}]
mentions: [{"name": "Marcus Aurelius", "sameAs": "https://en.wikipedia.org/wiki/Marcus_Aurelius"}, {"name": "Seneca", "sameAs": "https://en.wikipedia.org/wiki/Seneca_the_Younger"}, {"name": "Epictetus", "sameAs": "https://en.wikipedia.org/wiki/Epictetus"}, {"name": "Goodreads", "sameAs": "https://en.wikipedia.org/wiki/Goodreads"}]
---

Search for Stoic quotes and about one page in four will hand you a line the Stoics never wrote, with a Stoic's name under it.

We measured it. On November 12, 2026 we took the top 40 results for ten ordinary searches, read every page we could, and looked for the misattributions on [our documented list](/misattributed-stoic-quotes). Of 144 pages, 38 print at least one of them as a genuine quotation. That is 26 percent.

## The numbers

- **Searches:** 10
- **Distinct pages in the top 40 results:** 283
- **Pages we could read:** 144
- **Pages that publish a documented fake as genuine:** 38 (26%)
- **The same, leaving out the Epictetus paraphrase:** 36 (25%)
- **Pages carrying more than one:** 19
- **Pages that name the true source or flag the doubt:** 28

Counted by website instead of by page, it is 28 of 87 sites, about a third.

The problem does not thin out at the top. Of the 35 readable pages that ranked in the top ten for some search, 6 carry a fake.

## The first result is often the wrong one

For four of the ten searches the first result was a Goodreads author page: "marcus aurelius quotes", "marcus aurelius quotes on life", "seneca quotes" and "epictetus quotes". Each of those pages carries one.

On the Marcus Aurelius page, two lines are credited to "Marcus Aurelius, Meditations":

- "The object of life is not to be on the side of the majority, but to escape finding oneself in the ranks of the insane." This is Tolstoy, from *Bethink Yourselves!* (1904). It had 1,290 likes when we sampled.
- "Everything we hear is an opinion, not a fact. Everything we see is a perspective, not the truth." [No translation of the Meditations contains it](/did-marcus-aurelius-say-everything-we-hear-is-an-opinion). It had 4,120 likes.

The Seneca page carries "Luck is what happens when preparation meets opportunity", which is [an American saying from the twentieth century](/who-said-luck-is-what-happens-when-preparation-meets-opportunity). The Epictetus page carries "It's not what happens to you, but how you react to it that matters", which is [a modern paraphrase, not a translation](/did-epictetus-say-its-not-what-happens-to-you).

Goodreads quotes are added and voted on by readers, so no editor chose these. But the effect is the same: the page most people see first vouches for a line its author never wrote. AZQuotes, another large quote site in the sample, carries three on its Marcus Aurelius page.

The other first result deserves a mention too. The Daily Stoic's quote page ranked first for five of the ten searches, and it contains none of the lines we tested. Neither do the other nine Daily Stoic pages in the sample.

## The fakes we found

We tested 30 misattributions. Only seven turned up, and one accounts for most of the damage.

| Line | Credited to | Where it comes from | Pages |
|---|---|---|---|
| "When you arise in the morning, think of what a precious privilege it is to be alive..." | Marcus Aurelius | Elbert Hubbard, *The Fra* (1913) | 16 |
| "Everything we hear is an opinion, not a fact..." | Marcus Aurelius | [No source](/did-marcus-aurelius-say-everything-we-hear-is-an-opinion); a modern rewrite of *Meditations* II.15 | 10 |
| "A gem cannot be polished without friction, nor a man perfected without trials." | Seneca | [An anonymous proverb](/who-said-a-gem-cannot-be-polished-without-friction); earliest printing we found is a Victorian novel | 9 |
| "The object of life is not to be on the side of the majority..." | Marcus Aurelius | Leo Tolstoy, *Bethink Yourselves!* (1904) | 7 |
| "Luck is what happens when preparation meets opportunity." | Seneca | [A twentieth-century American saying](/who-said-luck-is-what-happens-when-preparation-meets-opportunity) | 7 |
| "It's not what happens to you, but how you react to it that matters." | Epictetus | [A modern paraphrase](/did-epictetus-say-its-not-what-happens-to-you) of *Enchiridion* 5 | 7 |
| "The greater the difficulty, the more glory in surmounting it." | Epictetus | Charles de Saint-Evremond, in an essay on Epicurus | 3 |

The tracing is not ours alone. Gregory Sadler found the Hubbard, Tolstoy and Saint-Evremond sources, and Thomas Colligan identified the "opinion, not a fact" line in his writing for Modern Stoicism.

The Epictetus line is a different kind of error from the rest. The idea is his, and only the sentence is modern. Some readers will not count a paraphrase as a fake, so the table above gives the rate both ways. It barely moves.

## Who publishes them

Not only quote sites. The 38 pages include a university housing blog, a photographer's blog, business magazines, a book-summary site and the websites of two apps.

We name Goodreads and AZQuotes here because they are large platforms and the finding rests on them. We are not listing the smaller sites in this article. Most are one person's blog, and the point is how common the error is, not who made it. Every page is in the dataset below for anyone who wants to check our work.

## How we did it

1. **The searches.** Ten queries a reader might type: "marcus aurelius quotes", "seneca quotes", "epictetus quotes", "stoic quotes", "stoicism quotes", "best stoic quotes", "famous stoic quotes", "stoic quotes on life", "meditations quotes" and "marcus aurelius quotes on life". We chose the second five before seeing their results and dropped none afterward.
2. **The sample.** The top 40 results for each, from the Brave Search API with the country set to the United States. That gave 400 results and 283 distinct pages. Our own pages were removed.
3. **Reading.** A program fetched each page under its own name, MarcusQuoteChecker, and obeyed robots.txt. It did not pretend to be a browser.
4. **What counts.** A page counts only if it prints one of the documented lines, credits it to the wrong person right beside the line or in the page title, and does not name the true source or discuss the attribution anywhere near it. A page that debunks a fake is the opposite of a hit, and 28 pages did some version of that.
5. **A person read every hit.** The first automatic pass counted three pages wrongly: two were explaining that the quotes are fake, and one credited its line to someone else. We tightened the rules, ran it again, and read all 38 remaining pages by hand.

## What this does not show

- **It is a floor.** We tested 30 lines we have documented. A page with a different fake counts as clean here. We also left out very short sayings such as "Know thyself", because they match too many innocent sentences.
- **Half the sample could not be read.** 139 of the 283 pages are missing from the rate. 56 disallow crawling, mostly Facebook, Reddit, Pinterest, Instagram and Quora. 50 refused our program, including Medium, BrainyQuote and Quotefancy. 27 returned no readable text, and 6 failed to load. The 26 percent describes pages an honest crawler can open, and says nothing about social posts.
- **Brave is not Google.** We used the search API we have access to. Rankings differ between engines, though the same sites tend to appear.
- **144 pages is a small sample**, and pages from the same site are not independent. The true rate could plausibly sit anywhere from about a fifth to a third. "About one in four" is as precise as this gets.
- **It is one day.** Rankings and pages change.
- **"Clean" means only that.** A page with none of our 30 lines may still misquote in other ways. We did not check wording, only attribution.

## The data

[Download the dataset (CSV)](/data/stoic-quote-study-2026-11.csv). It lists all 283 pages with the searches and ranks where each appeared, whether it could be read, and which lines were found. The program that produced it is [in our public repository](https://github.com/getmarcusapp/Marcus/blob/main/scripts/quote-study.js), and the list of misattributions it tests, with the source for each, is [here](/misattributed-stoic-quotes).

You may reuse the numbers and the data with a link to this page. If you find an error, including a page we counted wrongly, write to [hello@getmarcus.app](mailto:hello@getmarcus.app) and we will correct it and say so here.

## Why a wrong name matters

A fake quote usually isn't bad advice. The Hubbard line about the privilege of being alive is pleasant, and that is part of why it spreads.

The cost is to the reader's picture of the person. Marcus does write about getting up in the morning, in *Meditations* V.1, and he is arguing himself out of staying in bed. Someone who meets him through the Hubbard line meets a greeting card. The real passage is harder and more useful.

If you run a page of Stoic quotes, the fix is quick: ask each line for a work and a section. A genuine quotation has one. You can also paste a line into [our quote checker](/check-a-stoic-quote), which is free and tells you the source when it knows it.
