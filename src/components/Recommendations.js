import React, { Component } from 'react';

import { DataGrid } from '@material-ui/data-grid';

import aavegotchiContractAbi from '../abi/diamond.json';
import contract from '../config/aavegotchiContract.json';

import { connectToMatic } from '../util/MaticClient';
import { scoreWearable, wearablePositionLabel, wearableTraitModifiers, wearableBRSModifierLabel, wearableBySlot } from '../util/AavegotchiMath';

const _ = require('lodash');

// enter your aavegotchi number

// look up aavegotchi traits

// recommended wearables/wearable sets based on traits with listings sorted by the cheapest in the bazaar
// have a recommendation by each rarity type
// have a recommendation for each wearable slots

// estimated price and adjusted BRS score (and show the difference)

// check and uncheck recommended items to dynamically adjust price and BRS

// more advanced look up existing wearables on aavegotchi
class Recommendations extends Component {
  constructor(props) {
    super(props);

    this.state = {
      address: '',
      myAavegotchis: [], mySvgObjects: {},
      wearableListings: [], wearableListingsPagination: 90,
      wearableItemTypes: {}, wearableItemScores: {},

      slots: {
        'Body': false,
        'Face': false,
        'Eyes' : false,
        'Head': false,
        'Hand': false,
        'Pet': false,
        'Background': false,
        'Any': true,
      }
    };

    this.retrieveAavegotchis = this.retrieveAavegotchis.bind(this);
    this.retrieveWearables = this.retrieveWearables.bind(this);
    this.retrieveWearableDetails = this.retrieveWearableDetails.bind(this);

    this.selectAavegotchi = this.selectAavegotchi.bind(this);

    this.handleSlotChange = this.handleSlotChange.bind(this);
    this.onAddressChange = this.onAddressChange.bind(this);
  }

  onAddressChange(event) {
    event.preventDefault();
    this.setState({ address: event.target.value });
  }

  handleSlotChange(slot) {
    let currentSlots = this.state.slots;
    Object.keys(currentSlots).map(function(key, index){
      currentSlots[key] = false;
    });
    currentSlots[slot] = true;

    this.setState({ slots: currentSlots });
    // console.log(currentSlots);
  }

  componentDidMount() {
    const maticPOSClient = connectToMatic();

    const aavegotchiContract = new maticPOSClient.web3Client.web3.eth.Contract(aavegotchiContractAbi, contract.address);

    this.setState({ aavegotchiContract: aavegotchiContract });

    // this.retrieveAavegotchis(aavegotchiContract);

    setTimeout(()=> this.retrieveWearables(this.state.aavegotchiContract), 500);
  }

  retrieveAavegotchis(event) {
    event.preventDefault();

    const _this = this;

    // console.log('retrieveAavegotchis');

    this.state.aavegotchiContract.methods.allAavegotchisOfOwner(this.state.address).call().then(function (myAavegotchis) {
      _this.setState({ myAavegotchis: myAavegotchis });

      for (let a = 0; a < myAavegotchis.length; a++) {
        _this.state.aavegotchiContract.methods.getAavegotchiSvg(myAavegotchis[a].tokenId).call().then(function (svg) {
          let mySvgObjects = _this.state.mySvgObjects;
          mySvgObjects[myAavegotchis[a].tokenId] = svg;
          _this.setState({ mySvgObjects: mySvgObjects });
        }).catch(function (error) {
          console.log(error);
        });

        for (let e = 0; e < myAavegotchis[a].equippedWearables.length; e++) {
          let wearableId = myAavegotchis[a].equippedWearables[e];
          if (wearableId != "0") {
            _this.retrieveWearableDetails(_this.state.aavegotchiContract, wearableId);
          }
        }
      }
    });
  }

  retrieveWearableDetails(aavegotchiContract, wearableId) {
    const _this = this;
    if (!(wearableId in _this.state.wearableItemTypes)) {
      aavegotchiContract.methods.getItemType(wearableId).call().then(function (itemType) {
        let wearableItemTypes = _this.state.wearableItemTypes;
        wearableItemTypes[wearableId] = itemType;
        _this.setState({ wearableItemTypes: wearableItemTypes });
      }).catch(function (e) {
        console.log(e);
      });
    }
  }

  retrieveWearables(aavegotchiContract) {
    const _this = this;

    aavegotchiContract.methods.getERC1155Listings(0, "listed", this.state.wearableListingsPagination).call().then(function (listings) {
      _this.setState({ wearableListings: listings });

      // console.log(listings);

      for (let l = 0; l < listings.length; l++) {
        let itemId = listings[l].erc1155TypeId;
        _this.retrieveWearableDetails(aavegotchiContract, itemId);
      }
    }).catch(function (error) {
      console.log(error);
    });
  }

  selectAavegotchi(aavegotchiId) {
    const _this = this;

    this.setState({ selectedAavegotchiId : aavegotchiId });

    const aavegotchi = _.find(this.state.myAavegotchis, ['tokenId', aavegotchiId]);
    Object.keys(this.state.wearableItemTypes).map(function(key, index){
      const wearable = _this.state.wearableItemTypes[key];
      const score = scoreWearable(wearable, aavegotchi);

      let wearableItemScores = _this.state.wearableItemScores;
      wearableItemScores[key] = score;

      _this.setState({ wearableItemScores : wearableItemScores });
    });
  }

  renderRecommendations() {
    const _this = this;
    if (this.state.selectedAavegotchiId && this.state.wearableItemTypes && this.state.wearableListings.length === this.state.wearableListingsPagination) {
      const aavegotchi = _.find(_this.state.myAavegotchis, ['tokenId', _this.state.selectedAavegotchiId]);

      let rows = [];

      Object.keys(_this.state.wearableItemTypes).map(function(key, index){
        const wearable = _this.state.wearableItemTypes[key];
        const score = _this.state.wearableItemScores[key];
        const slot = wearablePositionLabel(wearable);
        const comparisonWearable = wearableBySlot(_this.state.wearableItemTypes, aavegotchi, slot);
        const wearableListings = _.orderBy(_.filter(_this.state.wearableListings, ['erc1155TypeId', key]), 'priceInWei', 'desc');

        let comparisonWearableScore = 0;
        let comparisonWearableName = 'Empty';
        let cheapestListing = { text: 'No Listing', link: 'https://aavegotchi.com/baazaar/wearables'};
        if (comparisonWearable !== null) {
          comparisonWearableScore = (scoreWearable(comparisonWearable, aavegotchi)).totalScore;
          comparisonWearableName = comparisonWearable.name;
        }

        if (wearableListings.length > 0) {
          cheapestListing = {
            text: (wearableListings[0].priceInWei / 1000000000000000000).toFixed(),
            link: `https://aavegotchi.com/baazaar/erc1155/${wearableListings[0].listingId}`
          }
        }

        if (_this.state.slots.Any || _this.state.slots[slot]) {
          rows.push({
            id: key,
            name: wearable.name,
            cheapestListing: cheapestListing,
            slot: slot,
            totalScore: (score.totalScore - comparisonWearableScore),
            comparisonItem: comparisonWearableName,
            rarityScore: score.rarityScore,
            nrgScore: score.nrgScore,
            aggScore: score.aggScore,
            spkScore: score.spkScore,
            brnScore: score.brnScore,
          });
        }
      });

      rows = _.orderBy(rows, 'totalScore', 'desc');

      const columns = [
        { field: 'id', headerName: 'ID', width: 70 },
        { field: 'name', headerName: 'Wearable Name', width: 180 },

        {
          field: 'cheapestListing',
          headerName: 'Cheapest Price',
          width: 160,
          renderCell: (params: GridCellParams) => (
            <a href={(params.value.link)} target="_blank" rel="noreferrer">
              {(params.value.text)}
            </a>
          )
        },

        { field: 'slot', headerName: 'Slot', width: 90 },
        { field: 'totalScore', headerName: 'Score Impact', width: 180 },
        { field: 'comparisonItem', headerName: 'Comparison Wearable', width: 190 },
        { field: 'rarityScore', headerName: 'Rarity', width: 120 },
        { field: 'nrgScore', headerName: 'NRG', width: 120 },
        { field: 'aggScore', headerName: 'AGG', width: 120 },
        { field: 'spkScore', headerName: 'SPK', width: 120 },
        { field: 'brnScore', headerName: 'BRN', width: 120 },
      ];

      return (
        <div>
          <h2>Wearable Recommendations</h2>
          <p>Wearables are retrieved from the {this.state.wearableListings.length} most recent wearable listings on the Aavegotchi Baazaar as well as from equipped wearables on your Aavegotchis.</p>
          <div className="col-12">
            <p><b>Wearable Slot</b></p>
            {
              Object.keys(this.state.slots).map(function(slot, index){
                return(
                  <div className="form-check-inline" key={`slot${slot}`}>
                    <label className="form-check-label">
                      <input type="radio" name="slot" className="form-check-input" defaultChecked={this.state.slots[slot]} onChange={() => this.handleSlotChange(slot)} /> {slot}
                    </label>
                  </div>
                );
              }, this)
            }
          </div>
          <h3>Results</h3>
          <p>The highest recommended wearables for <i>{aavegotchi.name}</i> are based on the <b>Score Impact</b> value which is determined by the wearable's impact on the traits of <i>{aavegotchi.name}</i>, the rarity of the wearable and any existing wearables <i>{aavegotchi.name}</i> has equipped in the relevant slot.</p>
          <p>Wearable prices are shown in GHST out of the {this.state.wearableListings.length} most recent wearable listings.</p>
          <div style={{ height: '600px', width: '100%' }}>
            <DataGrid rows={rows} columns={columns} pageSize={50} density="compact" />
          </div>
          <p>Note: boosts from <a href='https://wiki.aavegotchi.com/en/sets'>Wearable Sets</a> have not yet been implemented into this tool.</p>
        </div>
      );
    }
  }

  renderEquippedWearables() {
    const _this = this;
    const aavegotchi = _.find(this.state.myAavegotchis, ['tokenId', this.state.selectedAavegotchiId]);
    const slots = ['Body', 'Face', 'Eyes', 'Head', 'Left Hand', 'Right Hand', 'Pet', 'Background'];

    let equippedWearables = slots.map(function(value, index){
      if (aavegotchi.equippedWearables[index] !== "0") {
        const wearable = _this.state.wearableItemTypes[aavegotchi.equippedWearables[index]];
        return(
          <li key={wearable.name}>{value}: {wearable.name} ({wearableTraitModifiers(wearable.traitModifiers)} {wearableBRSModifierLabel(wearable.maxQuantity)})</li>
        );
      }
    }, this);

    return(
      <ul>
        {equippedWearables}
      </ul>
    )
  }

  renderSelectedAavegotchi() {
    if (this.state.selectedAavegotchiId) {
      const aavegotchi = _.find(this.state.myAavegotchis, ['tokenId', this.state.selectedAavegotchiId]);
      return(
        <div>
          <h2>Selected Aavegotchi</h2>
          <h3>{aavegotchi.name} ({aavegotchi.tokenId})</h3>
          <p>Your selected Aavegotchi</p>
          <div className="container">
            <div className="row">
              <div className="col">
                <h4>Traits</h4>
                <ul>
                  <li>Energy: {aavegotchi.numericTraits[0]}</li>
                  <li>Aggression: {aavegotchi.numericTraits[1]}</li>
                  <li>Spookiness: {aavegotchi.numericTraits[2]}</li>
                  <li>Brain Size: {aavegotchi.numericTraits[3]}</li>
                  <li>Eye Shape: {aavegotchi.numericTraits[4]}</li>
                  <li>Eye Score: {aavegotchi.numericTraits[5]}</li>
                  <li>Base Rarity Score: {aavegotchi.baseRarityScore}</li>
                  <li>Modified Rarity Score: {aavegotchi.modifiedRarityScore}</li>
                </ul>
              </div>
              <div className="col">
                <h4>Wearables</h4>
                {this.renderEquippedWearables()}
              </div>
            </div>
          </div>
        </div>
      );
    }
  }

  renderAavegotchiSvgs() {
    const _this = this;

    if (this.state.mySvgObjects && Object.keys(this.state.mySvgObjects).length > 0) {
      let myAavegotchiCards = Object.keys(this.state.mySvgObjects).map(function(key, index){
        let aavegotchi =_.find(this.state.myAavegotchis, ['tokenId', key]);
        let svgElement = {__html: this.state.mySvgObjects[key]};
        return (
          <div className="col-2" key={`svgcard${key}`}>
            <div className="card" style={ { width: '12rem'} }>
              <div className="card-img-top" dangerouslySetInnerHTML={svgElement}>
              </div>
              <div className="card-body">
                <h5 className="card-title">{aavegotchi.name} ({aavegotchi.tokenId})</h5>
                <p className="card-text">Rarity: {aavegotchi.modifiedRarityScore} ({aavegotchi.baseRarityScore})</p>
                <button className="btn btn-primary btn-sm" onClick={() => this.selectAavegotchi(aavegotchi.tokenId)}>Recommendations</button>
              </div>
            </div>
          </div>
        );
      }, this);

      return(
        <div>
          <h2>Aavegotchis</h2>
          <p>The Aavegotchis on the account {_this.state.address} are listed below.</p>
          <div className="container">
            <div className="row">
              {myAavegotchiCards}
            </div>
          </div>
        </div>
      );
    }
  }

  render() {
    return(
      <div>
        <h1>Recommendations</h1>
        <h2>Enter an Aavegotchi Account</h2>
        <p>Load the Aavegotchis from your account to discover recommended wearables from the Aavegotchi Baazaar.</p>
        <form className="row g-3" onSubmit={this.retrieveAavegotchis}>
          <div className="col-12">
            <label htmlFor="account" className="form-label"><b>Account</b></label>
            <input type="text" className="form-control" id="account" placeholder="Account" value={this.state.address} onChange={this.onAddressChange} />
          </div>
          <div className="col-12">
            <button type="submit" className="btn btn-primary">Retrieve Aavegotchis</button>
          </div>
        </form>
        {this.renderAavegotchiSvgs()}
        {this.renderSelectedAavegotchi()}
        {this.renderRecommendations()}
      </div>
    );
  }
}

export default Recommendations;