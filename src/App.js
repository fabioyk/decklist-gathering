import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';

import Header from './components/Header';
import Decklist from './components/Decklist';

const formats = ['Standard', 'Modern', 'Legacy', 'Vintage', 'Pauper'];

const redditSearchURL = 'https://www.reddit.com/r/Magicdeckbuilding+spikes/search.json?sort=new&restrict_sr=on&limit=100';

const tappedoutAPI = 'http://tappedout.net/api/deck/widget/?sort=type&deck=';
const tappedoutWebRegex = new RegExp('(http://tappedout.net/mtg-decks/.*?/)', 'i');
const tappedoutDeckRegex = new RegExp('(\\d+x[\\s\\S]*?>.*<\\/a>)|Sideboard|(Planeswalker \\()','ig');
const tappedoutSecondRegex = new RegExp('<.*?><.*?>', 'i');

const deckstatsAPI = 'https://deckstats.net/api.php?action=get_deck&';
const deckstatsWebRegex = new RegExp('https://deckstats.net/.*?[\\s\\?\\.]','i');

/*
Text examples:
https://www.reddit.com/r/spikes/comments/2vjddz/moderninterest_in_infect_primer_from_top/
https://www.reddit.com/r/spikes/comments/2xkiow/moderninfect_primer_part_2_deck_construction/
https://www.reddit.com/r/spikes/comments/5nnx0y/modern_on_cats_and_combos_a_jeskai_copycat_primer/
https://www.reddit.com/r/spikes/comments/27hjq6/standard_uwr_control_primer_with_some_testing/
https://www.reddit.com/r/spikes/comments/5tzf2t/elder_deepfiend_interaction_and_eldrazi_in/

*/

function handleErrors(response) {
    if (!response.ok) {
        throw Error(response.statusText);
    }
    return response;
}

class App extends Component {
  constructor(props) {
    super(props);

    this.organizeRedditData = this.organizeRedditData.bind(this);
    this.getFormatFromRedditThread = this.getFormatFromRedditThread.bind(this);
    this.getDecklistFromRedditThread = this.getDecklistFromRedditThread.bind(this);
    this.getDecklistFromFetch = this.getDecklistFromFetch.bind(this);

    this.state = {
      decklists: {}
    };
  }

  componentDidMount() {
    /*fetch(redditSearchURL)
      .then(handleErrors)
      .then(blob => blob.json(), err => {
        console.log('Failed to fetch decks, error: '+err);
        setTimeout(this.componentDidMount, 5000);
      })
      .then(this.organizeRedditData);*/
        
    this.setState({decklists: exampleData});        
  }

  organizeRedditData(data) {
    let organizedData = {};

    data.data.children.forEach(child => {
      if ((child.data.selftext.indexOf('/tappedout.net/') !== -1) || (child.data.selftext.indexOf('/deckstats.net/') !== -1) ) {
        console.log(child.data.subreddit,child.data.title);
        const deckData = this.getDecklistFromRedditThread(child);
        organizedData[child.data.id] = {
          redditUserName: child.data.author,
          subreddit: child.data.subreddit,
          format: this.getFormatFromRedditThread(child),
          threadTitle: child.data.title,
          decklist: deckData.promise,
          decklistUrl: deckData.url,
          key: child.data.id
        };
      }      
    });

    Object.keys(organizedData).forEach(key => {
      console.log(organizedData[key].subreddit,organizedData[key].title);
      organizedData[key].decklist = organizedData[key].decklist
        .then(handleErrors)
        .then(blob => blob.json())
        .then(data => organizedData[key].decklist = this.getDecklistFromFetch(data))
        .catch(err => {
          console.log('Error when fetching data for '+key+': '+err);
          delete organizedData[key];
        });      
    });

    Promise.all(Object.keys(organizedData).map(key=>organizedData[key].decklist))
      .then(() => {
        this.setState({decklists: organizedData});
        console.log(JSON.stringify(organizedData));
      } );

  }

  getFormatFromRedditThread(threadData) {
    const subreddit = threadData.data.subreddit;
    const linkFlair = threadData.data.link_flair_text;
    const threadTitle = threadData.data.title;

    let format;
    if (subreddit === 'Magicdeckbuilding') {
      format = linkFlair;
    } else if (subreddit === 'spikes') {
      format = linkFlair;
    }

    if (formats.indexOf(format) === -1) {
      format = 'Unknown';
    }

    return format;
  }

  getDecklistFromRedditThread(threadData) {
    const text = threadData.data.selftext;
    let isUrl = false;
    let url;
    let promiseUrl;
    if (!text) {
      isUrl = true;
      url = threadData.data.url;
    } else if (text.indexOf('/tappedout.net/') !== -1) {
      isUrl = true;
      url = text.match(tappedoutWebRegex)[0];
      const deckName = url.split('/')[4];
      promiseUrl = tappedoutAPI + deckName;      
    } else if (text.indexOf('/deckstats.net/') !== -1) {
      isUrl = true;
      console.log(text);
      url = text.match(deckstatsWebRegex)[0];

      let hasUser = true;
      promiseUrl = deckstatsAPI;
      const urlSplit = url.split('/');
      if (urlSplit[3] !== 'decks') {
        hasUser = false;
      }
      if (hasUser) {
        promiseUrl += 'owner_id=' + urlSplit[4] + '&id=' + urlSplit[5].split('-')[0] + '&id_type=saved';
      } else {
        const parts = urlSplit[3].split('-');
        promiseUrl += 'id=' + parts[1] + '&key=' + parts[2].split('.')[0] + '&id_type=temp';
      }
    }
    console.log(promiseUrl);
    if (isUrl) {
      return {
        promise: fetch(promiseUrl), 
        url: url};
    } else {
      return threadData.data.selftext;
    }
  }

  getDecklistFromFetch(data) {
    let cardCount = 0;

    if (!data) {
      console.log('Error');
      return 'not sure yet';
    }

      // TAPPEDOUT
    if (data.url && data.url.indexOf('tappedout') !== -1) {
      let cards = data.board.match(tappedoutDeckRegex);
      cards = cards.map(card => {
        let newC = card.replace(tappedoutSecondRegex, '');
        newC = newC.replace(/&#39;/gi, "'");
        newC = newC.split('<')[0];
        return newC;
      });

      const indexOfSideboard = cards.indexOf('Sideboard');
      const indexOfPlaneswalker = cards.indexOf('Planeswalker (');

      if (indexOfPlaneswalker !== -1 && indexOfSideboard !== -1 && indexOfPlaneswalker > indexOfSideboard) { 
        cards = [...cards.slice(0,indexOfSideboard), ...cards.slice(indexOfPlaneswalker+1), ...cards.slice(indexOfSideboard, indexOfPlaneswalker)];               
      } else if (indexOfPlaneswalker !== -1) {
        cards.splice(indexOfPlaneswalker,1);
      }
      return cards.join('<br/>');
      // DECKSTATS
    } else if (data.success && data.list) {
      let cards = data.list;
      cards = cards.replace('//Main\n','')
                   .replace(/[\r\n]/gi, '<br/>')
                   .replace('SB: ','')
                   .replace('//','');
      return cards;
    }
    if (data.errors) {
        return data.errors['__all__'];
      }
    return 'not sure yet';
  }

  render() {
    return (
      <div className="App">
        <div className="App-header">
          <Header />
        </div>
        <div className="App-intro">
          {
            Object.keys(this.state.decklists).length > 0 ? 
              Object.keys(this.state.decklists).map(key =>
                <Decklist 
                  key={key}
                  redditUserName={this.state.decklists[key].redditUserName}
                  subreddit={this.state.decklists[key].subreddit}
                  format={this.state.decklists[key].format}
                  threadTitle={this.state.decklists[key].threadTitle}
                  decklist={this.state.decklists[key].decklist} />
              )
            :
              <p>Loading...</p>
                        
          }
        </div>
      </div>
    );
  }
}

export default App;


const exampleData = {
   "5u9z74":{
      "redditUserName":"blackgreenx",
      "subreddit":"spikes",
      "format":"Standard",
      "threadTitle":"[Standard][Primer] Mono Black Eldrazi",
      "decklist":"4x\n            \n            \nBearer of Silence<br/>4x\n            \n            \nMatter Reshaper<br/>4x\n            \n            \nReality Smasher<br/>3x\n            \n            \nScrapheap Scrounger<br/>4x\n            \n            \nThought-Knot Seer<br/>2x\n            \n            \nWalking Ballista<br/>3x\n            \n            \nWasteland Strangler<br/>4x\n            \n            \nTransgress the Mind<br/>4x\n            \n            \nAether Hub<br/>2x\n            \n            \nBlighted Fen<br/>4x\n            \n            \nRuins of Oran-Rief<br/>3x\n            \n            \nSea Gate Wreckage<br/>11x\n            \n            \nSwamp<br/>4x\n            \n            \nFatal Push<br/>4x\n            \n            \nGrasp of Darkness<br/>Sideboard<br/>2x\n            \n            \nDistended Mindbender<br/>2x\n            \n            \nKalitas, Traitor of Ghet<br/>3x\n            \n            \nMurder<br/>1x\n            \n            \nOb Nixilis Reignited<br/>2x\n            \n            \nRuinous Path<br/>1x\n            \n            \nSkysovereign, Consul Flagship<br/>2x\n            \n            \nWalking Ballista<br/>2x\n            \n            \nYahenni's Expertise",
      "decklistUrl":"http://tappedout.net/mtg-decks/15-02-17-bc/",
      "key":"5u9z74"
   },
   "5u7o4f":{
      "redditUserName":"GarciLP",
      "subreddit":"Magicdeckbuilding",
      "format":"Unknown",
      "threadTitle":"[Casual] R/W Boros deck",
      "decklist":"1 Archangel Avacyn<br/>1 Aurelia, the Warleader<br/>2 Baneslayer Angel<br/>4 Boros Elite<br/>4 Boros Recruit<br/>2 Figure of Destiny<br/>2 Firemane Angel<br/>2 Firemane Avenger<br/>1 Gisela, Blade of Goldnight<br/>2 Glory of Warfare<br/>1 Godsend<br/>4 Lightning Helix<br/>8 Mountain<br/>2 Nobilis of War<br/>10 Plains<br/>2 Rally the Righteous<br/>1 Razia, Boros Archangel<br/>2 Stoneforge Mystic<br/>2 Sunforger<br/>2 Swords to Plowshares<br/>1 Tajic, Blade of the Legion<br/>2 Taurean Mauler<br/>2 Wojek Halberdiers<br/>",
      "decklistUrl":"https://deckstats.net/deck-12409564-725f47b5de9d3a202989003dc0865e6d.",
      "key":"5u7o4f"
   },
   "5u7ioi":{
      "redditUserName":"Ajnodanna",
      "subreddit":"Magicdeckbuilding",
      "format":"Standard",
      "threadTitle":"Standard turbo fog/Awaken control",
      "decklist":"4x\n            \n            \nAether Hub<br/>1x\n            \n            \nBlighted Fen<br/>1x\n            \n            \nBlooming Marsh<br/>2x\n            \n            \nBotanical Sanctum<br/>1x\n            \n            \nCanopy Vista<br/>3x\n            \n            \nForest<br/>5x\n            \n            \nIsland<br/>3x\n            \n            \nLumbering Falls<br/>3x\n            \n            \nPlains<br/>1x\n            \n            \nSwamp<br/>1x\n            \n            \nNissa, Vital Force<br/>4x\n            \n            \nCommencement of Festivities<br/>2x\n            \n            \nDisappearing Act<br/>4x\n            \n            \nEncircling Fissure<br/>2x\n            \n            \nNegate<br/>2x\n            \n            \nRepel the Abominable<br/>4x\n            \n            \nScatter to the Winds<br/>4x\n            \n            \nAttune with Aether<br/>4x\n            \n            \nClutch of Currents<br/>2x\n            \n            \nPlanar Outburst<br/>1x\n            \n            \nGhirapur Orrery<br/>Sideboard<br/>2x\n            \n            \nCeremonious Rejection<br/>2x\n            \n            \nCultivator of Blades<br/>2x\n            \n            \nFragmentize<br/>2x\n            \n            \nMetallic Rebuke<br/>2x\n            \n            \nNegate<br/>2x\n            \n            \nRevolutionary Rebuff<br/>1x\n            \n            \nRuinous Path<br/>2x\n            \n            \nSkywhaler's Shot<br/>1x\n            \n            \nBaral, Chief of Compliance<br/>4x\n            \n            \nHalimar Tidecaller<br/>2x\n            \n            \nTireless Tracker",
      "decklistUrl":"http://tappedout.net/mtg-decks/natures-land-control/",
      "key":"5u7ioi"
   },
   "5u5eoo":{
      "redditUserName":"LegitOtaku",
      "subreddit":"Magicdeckbuilding",
      "format":"Standard",
      "threadTitle":"B/R Aggro brewing (Standard)",
      "decklist":"2 Bloodhall Priest<br/>4 Bomat Courier<br/>2 Fiery Temper<br/>2 Fleetwheel Cruiser<br/>4 Foreboding Ruins<br/>4 Inventor's Apprentice<br/>2 Kari Zev's Expertise<br/>2 Kari Zev, Skyship Raider<br/>10 Mountain<br/>3 Pia Nalaar<br/>4 Scrapheap Scrounger<br/>3 Shock<br/>2 Smoldering Marsh<br/>7 Swamp<br/>4 Unlicensed Disintegration<br/>1 Lightning Axe<br/>4 Forerunner of Slaughter<br/><br/>Sideboard<br/>2 Combustible Gearhulk<br/>SB: 2 Ob Nixilis Reignited<br/>SB: 1 Fatal Push<br/>SB: 2 Ruinous Path<br/>SB: 1 Key to the City<br/>SB: 2 Noxious Gearhulk<br/>SB: 3 Lightning Axe<br/>SB: 2 Release the Gremlins<br/>",
      "decklistUrl":"https://deckstats.net/decks/75556/666507-red-black-aggro?",
      "key":"5u5eoo"
   },
   "5u51az":{
      "redditUserName":"eodude",
      "subreddit":"Magicdeckbuilding",
      "format":"Modern",
      "threadTitle":"Need help with Midrange Temur Dragons",
      "decklist":"4x\n            \n            \nCourser of Kruphix<br/>2x\n            \n            \nDragonlord Atarka<br/>3x\n            \n            \nIcefall Regent<br/>4x\n            \n            \nRattleclaw Mystic<br/>2x\n            \n            \nSavage Ventmaw<br/>4x\n            \n            \nSylvan Caryatid<br/>4x\n            \n            \nThunderbreak Regent<br/>2x\n            \n            \nFrontier Bivouac<br/>2x\n            \n            \nHaven of the Spirit Dragon<br/>6x\n            \n            \nIsland<br/>4x\n            \n            \nMountain<br/>4x\n            \n            \nRootbound Crag<br/>4x\n            \n            \nTemple of Mystery<br/>1x\n            \n            \nDragon Tempest<br/>1x\n            \n            \nTemur Ascendancy<br/>2x\n            \n            \nAtarka's Command<br/>4x\n            \n            \nDraconic Roar<br/>4x\n            \n            \nStubborn Denial<br/>3x\n            \n            \nKiora, Master of the Depths<br/>3x\n            \n            \nSarkhan Unbroken<br/>2x\n            \n            \nUgin, the Spirit Dragon",
      "decklistUrl":"http://tappedout.net/mtg-decks/11-02-17-temur-dragons/",
      "key":"5u51az"
   },
   "5u4o0p":{
      "redditUserName":"SovFist",
      "subreddit":"Magicdeckbuilding",
      "format":"Standard",
      "threadTitle":"Green Blue Energy .. something? Need help. It uses Trophy Mage.",
      "decklist":"4x\n            \n            \nAether Swooper<br/>4x\n            \n            \nElectrostatic Pummeler<br/>4x\n            \n            \nLongtusk Cub<br/>4x\n            \n            \nThriving Turtle<br/>4x\n            \n            \nTrophy Mage<br/>2x\n            \n            \nAether Hub<br/>4x\n            \n            \nBotanical Sanctum<br/>7x\n            \n            \nForest<br/>7x\n            \n            \nIsland<br/>4x\n            \n            \nWoodland Stream<br/>4x\n            \n            \nAttune with Aether<br/>4x\n            \n            \nLarger Than Life<br/>4x\n            \n            \nSlip Through Space<br/>4x\n            \n            \nBlossoming Defense",
      "decklistUrl":"http://tappedout.net/mtg-decks/trophy-energy-beatdown/",
      "key":"5u4o0p"
   },
   "5u288c":{
      "redditUserName":"Illined",
      "subreddit":"Magicdeckbuilding",
      "format":"Standard",
      "threadTitle":"UW KLD/AER Blink deck",
      "decklist":"3x\n            \n            \nCloudblazer<br/>4x\n            \n            \nFelidar Guardian<br/>4x\n            \n            \nFiligree Familiar<br/>1x\n            \n            \nHope of Ghirapur<br/>1x\n            \n            \nSalvage Scuttler<br/>2x\n            \n            \nSolemn Recruit<br/>3x\n            \n            \nSpire Patrol<br/>1x\n            \n            \nTrophy Mage<br/>1x\n            \n            \nWalking Ballista<br/>2x\n            \n            \nWispweaver Angel<br/>1x\n            \n            \nBaral's Expertise<br/>2x\n            \n            \nFragmentize<br/>1x\n            \n            \nFumigate<br/>11x\n            \n            \nIsland<br/>13x\n            \n            \nPlains<br/>3x\n            \n            \nAcrobatic Maneuver<br/>2x\n            \n            \nIllusionist's Stratagem<br/>2x\n            \n            \nCall for Unity<br/>1x\n            \n            \nConsulate Crackdown<br/>2x\n            \n            \nImplement of Improvement",
      "decklistUrl":"http://tappedout.net/mtg-decks/uw-blink-kaladeshrevolt/",
      "key":"5u288c"
   },
   "5u1uyj":{
      "redditUserName":"Cvoz",
      "subreddit":"Magicdeckbuilding",
      "format":"Standard",
      "threadTitle":"[Standard] Green White Revolt",
      "decklist":"4x\n            \n            \nAethergeode Miner<br/>4x\n            \n            \nFelidar Guardian<br/>4x\n            \n            \nGreenbelt Rampager<br/>4x\n            \n            \nGreenwheel Liberator<br/>4x\n            \n            \nNarnam Renegade<br/>4x\n            \n            \nRenegade Rallier<br/>4x\n            \n            \nSolemn Recruit<br/>4x\n            \n            \nCanopy Vista<br/>4x\n            \n            \nEvolving Wilds<br/>5x\n            \n            \nForest<br/>4x\n            \n            \nFortified Village<br/>5x\n            \n            \nPlains<br/>4x\n            \n            \nBlossoming Defense<br/>4x\n            \n            \nLifecrafter's Bestiary<br/>Sideboard<br/>3x\n            \n            \nAuthority of the Consuls<br/>4x\n            \n            \nFragmentize<br/>4x\n            \n            \nHeroic Intervention<br/>2x\n            \n            \nOath of Ajani<br/>2x\n            \n            \nRishkar, Peema Renegade<br/>2x\n            \n            \nAlways Watching ",
      "decklistUrl":"http://tappedout.net/mtg-decks/07-02-17-green-white-revolt/",
      "key":"5u1uyj"
   },
   "5u1nb6":{
      "redditUserName":"Moojdart",
      "subreddit":"spikes",
      "format":"Standard",
      "threadTitle":"[Standard] Needing some guidance with my Bant deck.",
      "decklist":"3x\n            \n            \nCanopy Vista<br/>3x\n            \n            \nEvolving Wilds<br/>5x\n            \n            \nForest<br/>3x\n            \n            \nFortified Village<br/>4x\n            \n            \nIsland<br/>2x\n            \n            \nLumbering Falls<br/>3x\n            \n            \nPlains<br/>1x\n            \n            \nPrairie Stream<br/>2x\n            \n            \nBlossoming Defense<br/>2x\n            \n            \nArchangel Avacyn<br/>2x\n            \n            \nRishkar, Peema Renegade<br/>3x\n            \n            \nRogue Refiner<br/>4x\n            \n            \nSylvan Advocate<br/>4x\n            \n            \nThraben Inspector<br/>3x\n            \n            \nTireless Tracker<br/>2x\n            \n            \nVerdurous Gearhulk<br/>2x\n            \n            \nOath of Ajani<br/>4x\n            \n            \nOath of Nissa<br/>2x\n            \n            \nStasis Snare<br/>1x\n            \n            \nAjani Unyielding<br/>2x\n            \n            \nNissa, Voice of Zendikar<br/>3x\n            \n            \nTamiyo, Field Researcher<br/>Sideboard<br/>2x\n            \n            \nHeroic Intervention<br/>2x\n            \n            \nImmolating Glare<br/>3x\n            \n            \nNatural State<br/>2x\n            \n            \nNegate<br/>2x\n            \n            \nSelfless Spirit<br/>2x\n            \n            \nSpell Queller<br/>2x\n            \n            \nUlvenwald Mysteries",
      "decklistUrl":"http://tappedout.net/mtg-decks/14-02-17-bant-midrange/",
      "key":"5u1nb6"
   },
   "5u1i7w":{
      "redditUserName":"Krytos",
      "subreddit":"Magicdeckbuilding",
      "format":"Standard",
      "threadTitle":"[standard] GW statuary angel ramp",
      "decklist":"2 Ajani Unyielding<br/>1 Archangel Avacyn<br/>3 Blessed Alliance<br/>2 Bruna, the Fading Light<br/>4 Canopy Vista<br/>4 Deathcap Cultivator<br/>4 Evolving Wilds<br/>4 Forest<br/>4 Fortified Village<br/>1 Geier Reach Sanitarium<br/>3 Gisela, the Broken Blade<br/>4 Inspiring Statuary<br/>1 Odric, Lunarch Marshal<br/>8 Plains<br/>2 Quarantine Field<br/>1 Rishkar, Peema Renegade<br/>2 Thalia's Lancers<br/>1 Thalia, Heretic Cathar<br/>3 Thraben Inspector<br/>4 Tireless Tracker<br/>2 Vessel of Nascency<br/>",
      "decklistUrl":"https://deckstats.net/deck-12401856-d5c85b56ccc37d94083574a72fd80f33.",
      "key":"5u1i7w"
   },
   "5typ40":{
      "redditUserName":"BrokenEnchanter",
      "subreddit":"Magicdeckbuilding",
      "format":"Standard",
      "threadTitle":"Standard sultai",
      "decklist":"2x\n            \n            \nAether Hub<br/>3x\n            \n            \nBlooming Marsh<br/>1x\n            \n            \nBotanical Sanctum<br/>4x\n            \n            \nEvolving Wilds<br/>1x\n            \n            \nForest<br/>3x\n            \n            \nIsland<br/>2x\n            \n            \nLumbering Falls<br/>4x\n            \n            \nSunken Hollow<br/>4x\n            \n            \nSwamp<br/>4x\n            \n            \nTraverse the Ulvenwald<br/>2x\n            \n            \nDisallow<br/>3x\n            \n            \nFatal Push<br/>3x\n            \n            \nGlimmer of Genius<br/>3x\n            \n            \nGrapple with the Past<br/>3x\n            \n            \nGrasp of Darkness<br/>1x\n            \n            \nMurder<br/>2x\n            \n            \nNegate<br/>2x\n            \n            \nTo the Slaughter<br/>2x\n            \n            \nGonti, Lord of Luxury<br/>2x\n            \n            \nIshkanah, Grafwidow<br/>1x\n            \n            \nKalitas, Traitor of Ghet<br/>1x\n            \n            \nNoxious Gearhulk<br/>2x\n            \n            \nTireless Tracker<br/>3x\n            \n            \nTorrential Gearhulk<br/>2x\n            \n            \nWalking Ballista<br/>Sideboard<br/>1x\n            \n            \nFatal Push<br/>2x\n            \n            \nFlaying Tendrils<br/>2x\n            \n            \nLost Legacy<br/>2x\n            \n            \nOverwhelming Denial<br/>2x\n            \n            \nPick the Brain<br/>2x\n            \n            \nRuinous Path<br/>1x\n            \n            \nTo the Slaughter<br/>2x\n            \n            \nTransgress the Mind<br/>1x\n            \n            \nYahenni's Expertise",
      "decklistUrl":"http://tappedout.net/mtg-decks/14-02-17-sultai-delirium-control/",
      "key":"5typ40"
   },
   "5txwq2":{
      "redditUserName":"Axelfiraga",
      "subreddit":"Magicdeckbuilding",
      "format":"Modern",
      "threadTitle":"[Modern] Flip it to win it (modern U/R coin flipping), need some help finding a wincon/fine tuning.",
      "decklist":"4x\n            \n            \nFiery Gambit<br/>4x\n            \n            \nMana Clash<br/>4x\n            \n            \nMolten Birth<br/>4x\n            \n            \nSleight of Hand<br/>4x\n            \n            \nStitch in Time<br/>2x\n            \n            \nSpellheart Chimera<br/>4x\n            \n            \nBattlefield Forge<br/>1x\n            \n            \nDesolate Lighthouse<br/>5x\n            \n            \nIsland<br/>8x\n            \n            \nMountain<br/>4x\n            \n            \nShivan Reef<br/>4x\n            \n            \nLightning Bolt<br/>2x\n            \n            \nOdds<br/>4x\n            \n            \nPyromancer Ascension<br/>4x\n            \n            \nKrark's Thumb<br/>2x\n            \n            \nRal Zarek",
      "decklistUrl":"http://tappedout.net/mtg-decks/heads-or-heads-modern-coin-flipping/",
      "key":"5txwq2"
   },
   "5twwk9":{
      "redditUserName":"SnowSisters",
      "subreddit":"Magicdeckbuilding",
      "format":"Modern",
      "threadTitle":"[Modern] Mono-White Soul Sisters Brewing",
      "decklist":"4x\n            \n            \nAjani's Pridemate<br/>1x\n            \n            \nArchangel of Thune<br/>3x\n            \n            \nMartyr of Sands<br/>3x\n            \n            \nRanger of Eos<br/>3x\n            \n            \nSerra Ascendant<br/>4x\n            \n            \nSoul Warden<br/>4x\n            \n            \nSoul's Attendant<br/>4x\n            \n            \nSquadron Hawk<br/>15x\n            \n            \nPlains<br/>1x\n            \n            \nWestvale Abbey<br/>4x\n            \n            \nWindbrisk Heights<br/>2x\n            \n            \nProclamation of Rebirth<br/>4x\n            \n            \nSpectral Procession<br/>4x\n            \n            \nPath to Exile<br/>4x\n            \n            \nHonor of the Pure<br/>Sideboard<br/>2x\n            \n            \nCelestial Purge<br/>2x\n            \n            \nDismember<br/>3x\n            \n            \nLeyline of Sanctity<br/>2x\n            \n            \nRest in Peace<br/>2x\n            \n            \nSpellskite<br/>2x\n            \n            \nStony Silence<br/>2x\n            \n            \nSundering Growth",
      "decklistUrl":"http://tappedout.net/mtg-decks/13-02-17-mono-white-soul-sisters/",
      "key":"5twwk9"
   },
   "5tvekf":{
      "redditUserName":"PluviusReddit",
      "subreddit":"Magicdeckbuilding",
      "format":"Standard",
      "threadTitle":"Fabrication Module and Winding Constrictor?",
      "decklist":"3x\n            \n            \nGlint-Sleeve Siphoner<br/>4x\n            \n            \nGreenbelt Rampager<br/>3x\n            \n            \nLongtusk Cub<br/>4x\n            \n            \nRogue Refiner<br/>3x\n            \n            \nServant of the Conduit<br/>4x\n            \n            \nTrophy Mage<br/>2x\n            \n            \nWalking Ballista<br/>4x\n            \n            \nWinding Constrictor<br/>4x\n            \n            \nAttune with Aether<br/>4x\n            \n            \nAether Hub<br/>2x\n            \n            \nBlooming Marsh<br/>2x\n            \n            \nBotanical Sanctum<br/>5x\n            \n            \nForest<br/>3x\n            \n            \nIsland<br/>2x\n            \n            \nSunken Hollow<br/>2x\n            \n            \nSwamp<br/>2x\n            \n            \nDeadlock Trap<br/>4x\n            \n            \nFabrication Module<br/>1x\n            \n            \nLifecrafter's Bestiary<br/>Sideboard<br/>1x\n            \n            \nAether Meltdown<br/>2x\n            \n            \nBlossoming Defense<br/>2x\n            \n            \nBristling Hydra<br/>2x\n            \n            \nDie Young<br/>3x\n            \n            \nFatal Push<br/>2x\n            \n            \nNegate<br/>1x\n            \n            \nSwamp<br/>2x\n            \n            \nYahenni's Expertise<br/>2x\n            \n            \nAether Meltdown",
      "decklistUrl":"http://tappedout.net/mtg-decks/13-02-17-sultai-counters/",
      "key":"5tvekf"
   },
   "5tui18":{
      "redditUserName":"BlaineTog",
      "subreddit":"Magicdeckbuilding",
      "format":"Standard",
      "threadTitle":"Aetheristocrats -- Mono-Black Aetherborn Tribal, featuring Yahenni",
      "decklist":"4x\n            \n            \nGifted Aetherborn<br/>2x\n            \n            \nGonti, Lord of Luxury<br/>1x\n            \n            \nHerald of Anguish<br/>4x\n            \n            \nMetallic Mimic<br/>4x\n            \n            \nMidnight Entourage<br/>4x\n            \n            \nWeaponcraft Enthusiast<br/>3x\n            \n            \nYahenni, Undying Partisan<br/>2x\n            \n            \nBlighted Fen<br/>19x\n            \n            \nSwamp<br/>2x\n            \n            \nWestvale Abbey<br/>4x\n            \n            \nGrasp of Darkness<br/>2x\n            \n            \nMurder<br/>2x\n            \n            \nHarsh Scrutiny<br/>4x\n            \n            \nDead Weight<br/>Sideboard<br/>1x\n            \n            \nHarsh Scrutiny<br/>3x\n            \n            \nLost Legacy<br/>2x\n            \n            \nMurder<br/>3x\n            \n            \nRuinous Path<br/>3x\n            \n            \nTo the Slaughter<br/>3x\n            \n            \nTransgress the Mind<br/>3x\n            \n            \nAnimation Module",
      "decklistUrl":"http://tappedout.net/mtg-decks/aetheristocrats-3/",
      "key":"5tui18"
   },
   "5tuhgz":{
      "redditUserName":"Rovsnegl",
      "subreddit":"Magicdeckbuilding",
      "format":"Unknown",
      "threadTitle":"Substitute for Shambling Vent",
      "decklist":"2x\n            \n            \nBloodbond Vampire<br/>1x\n            \n            \nDrana, Liberator of Malakir<br/>4x\n            \n            \nDrana's Emissary<br/>4x\n            \n            \nExpedition Envoy<br/>4x\n            \n            \nKalastria Healer<br/>2x\n            \n            \nKor Bladewhirl<br/>3x\n            \n            \nKor Castigator<br/>4x\n            \n            \nLantern Scout<br/>1x\n            \n            \nMalakir Familiar<br/>1x\n            \n            \nMalakir Familiar<br/>3x\n            \n            \nSerene Steward<br/>3x\n            \n            \nAlly Encampment<br/>1x\n            \n            \nBlighted Steppe<br/>2x\n            \n            \nCaves of Koilos<br/>10x\n            \n            \nPlains<br/>1x\n            \n            \nShambling Vent<br/>7x\n            \n            \nSwamp<br/>2x\n            \n            \nRetreat to Emeria<br/>2x\n            \n            \nVampiric Rites<br/>Sideboard<br/>2x\n            \n            \nAlhammarret's Archive<br/>2x\n            \n            \nCarrier Thrall<br/>1x\n            \n            \nDefiant Bloodlord<br/>2x\n            \n            \nFoul-Tongue Shriek<br/>3x\n            \n            \nQarsi Sadist<br/>2x\n            \n            \nRetreat to Hagra<br/>3x\n            \n            \nZulaport Cutthroat<br/>3x\n            \n            \nTandem Tactics",
      "decklistUrl":"http://tappedout.net/mtg-decks/i-drink-your-milkshake-under-50/",
      "key":"5tuhgz"
   },
   "5ttfp5":{
      "redditUserName":"DatBandit",
      "subreddit":"Magicdeckbuilding",
      "format":"Standard",
      "threadTitle":"[Standard] UB Improvise - Constructive criticism wanted!",
      "decklist":"3x\n            \n            \nBastion Inventor<br/>2x\n            \n            \nGonti, Lord of Luxury<br/>2x\n            \n            \nHerald of Anguish<br/>2x\n            \n            \nHope of Ghirapur<br/>2x\n            \n            \nMerchant's Dockhand<br/>2x\n            \n            \nOrnithopter<br/>1x\n            \n            \nWalking Ballista<br/>1x\n            \n            \nDisallow<br/>1x\n            \n            \nFatal Push<br/>3x\n            \n            \nMetallic Rebuke<br/>3x\n            \n            \nMurder<br/>4x\n            \n            \nReverse Engineer<br/>4x\n            \n            \nTezzeret's Touch<br/>10x\n            \n            \nIsland<br/>4x\n            \n            \nSubmerged Boneyard<br/>10x\n            \n            \nSwamp<br/>3x\n            \n            \nKey to the City<br/>3x\n            \n            \nServo Schematic",
      "decklistUrl":"http://tappedout.net/mtg-decks/13-02-17-TCj-ub-improvise/",
      "key":"5ttfp5"
   },
   "5trf2w":{
      "redditUserName":"theenduser",
      "subreddit":"Magicdeckbuilding",
      "format":"Standard",
      "threadTitle":"[Standard] Abzan Constrictor Deck - How to Beat Mardu Vehicles?",
      "decklist":"2x\n            \n            \nArchangel Avacyn<br/>2x\n            \n            \nLambholt Pacifist<br/>3x\n            \n            \nRishkar, Peema Renegade<br/>2x\n            \n            \nSylvan Advocate<br/>1x\n            \n            \nTireless Tracker<br/>3x\n            \n            \nVerdurous Gearhulk<br/>4x\n            \n            \nWalking Ballista<br/>4x\n            \n            \nWinding Constrictor<br/>2x\n            \n            \nAethersphere Harvester<br/>2x\n            \n            \nHeart of Kiran<br/>4x\n            \n            \nBlooming Marsh<br/>4x\n            \n            \nCanopy Vista<br/>4x\n            \n            \nConcealed Courtyard<br/>6x\n            \n            \nForest<br/>5x\n            \n            \nPlains<br/>2x\n            \n            \nSwamp<br/>1x\n            \n            \nBlossoming Defense<br/>2x\n            \n            \nFatal Push<br/>4x\n            \n            \nGideon, Ally of Zendikar<br/>3x\n            \n            \nNissa, Voice of Zendikar<br/>Sideboard<br/>1x\n            \n            \nAjani Unyielding<br/>2x\n            \n            \nAuthority of the Consuls<br/>2x\n            \n            \nDeclaration in Stone<br/>2x\n            \n            \nFragmentize<br/>2x\n            \n            \nFumigate<br/>1x\n            \n            \nGisela, the Broken Blade<br/>1x\n            \n            \nHeroic Intervention<br/>1x\n            \n            \nLifecrafter's Bestiary<br/>2x\n            \n            \nStasis Snare<br/>1x\n            \n            \nTireless Tracker",
      "decklistUrl":"http://tappedout.net/mtg-decks/abzan-constrictor-standard/",
      "key":"5trf2w"
   },
   "5tpszc":{
      "redditUserName":"Gugabvs",
      "subreddit":"Magicdeckbuilding",
      "format":"Standard",
      "threadTitle":"Help with changes.",
      "decklist":"2x\n            \n            \nBotanical Sanctum<br/>1x\n            \n            \nForest<br/>2x\n            \n            \nInventors' Fair<br/>6x\n            \n            \nIsland<br/>1x\n            \n            \nMountain<br/>4x\n            \n            \nSanctum of Ugin<br/>2x\n            \n            \nSpawning Bed<br/>3x\n            \n            \nSpirebluff Canal<br/>2x\n            \n            \nWestvale Abbey<br/>2x\n            \n            \nKozilek's Return<br/>3x\n            \n            \nMetallic Rebuke<br/>3x\n            \n            \nSpatial Contortion<br/>4x\n            \n            \nCultivator's Caravan<br/>3x\n            \n            \nHedron Archive<br/>3x\n            \n            \nMetalspinner's Puzzleknot<br/>4x\n            \n            \nProphetic Prism<br/>2x\n            \n            \nRenegade Map<br/>2x\n            \n            \nSkysovereign, Consul Flagship<br/>2x\n            \n            \nElder Deep-Fiend<br/>4x\n            \n            \nGlint-Nest Crane<br/>4x\n            \n            \nMetalwork Colossus<br/>1x\n            \n            \nWorld Breaker<br/>Sideboard<br/>2x\n            \n            \nCeremonious Rejection<br/>1x\n            \n            \nChandra, Flamecaller<br/>2x\n            \n            \nEndbringer<br/>2x\n            \n            \nKozilek's Return<br/>1x\n            \n            \nMetallic Rebuke<br/>2x\n            \n            \nNegate<br/>3x\n            \n            \nThought-Knot Seer<br/>1x\n            \n            \nUlamog, the Ceaseless Hunger<br/>1x\n            \n            \nWorld Breaker",
      "decklistUrl":"http://tappedout.net/mtg-decks/timur-colossus/",
      "key":"5tpszc"
   }
};