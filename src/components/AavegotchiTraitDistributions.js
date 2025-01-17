import React, { Component } from 'react';

// import aavegotchis from '../data/aavegotchis/graphaavegotchis.json';

import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

import { DataGrid } from '@material-ui/data-grid';

const _ = require('lodash');
const axios = require('axios');

class AavegotchiTraitDistributions extends Component {
  constructor(props) {
    super(props);

    this.renderTraitsDistribution = this.renderTraitsDistribution.bind(this);

    this.state = {
      gotchisByTraitValue: [],
      traits: ['Energy', 'Aggression', 'Spookiness', 'Brain Size', 'Eye Shape', 'Eye Color'],
      aavegotchis: {}
    };
  }

  async componentDidMount() {
    let aavegotchis = {};
    for (let i = 0; i < 8; i++) {
      let skip = i * 1000;
      const queriedAavegotchis = await axios.post(
        'https://api.thegraph.com/subgraphs/name/aavegotchi/aavegotchi-core-matic',
        {
          query: `
          {
            aavegotchis(first: 1000, skip: ${skip}, orderBy: id, orderDirection:asc, where:{ status: 3 }) {
              id
              hauntId
              name
              numericTraits
              baseRarityScore
              modifiedRarityScore
            }
          }`
        }
      );

      if (queriedAavegotchis.data.data && queriedAavegotchis.data.data.aavegotchis.length > 0) {
        for (var a = 0; a < queriedAavegotchis.data.data.aavegotchis.length; a++) {
          aavegotchis[queriedAavegotchis.data.data.aavegotchis[a].id] = queriedAavegotchis.data.data.aavegotchis[a];
        }
      } else {
        break;
      }
    }

    this.setState({ aavegotchis: aavegotchis, summonedGotchis: Object.keys(aavegotchis).length });
  }

  calculateData(trait) {
    let data = [];
    for (let tv = 0; tv < 101; tv++) {
      let filteredAavegotchis = _.filter(this.state.aavegotchis, [`numericTraits[${trait}]`, tv]);
      let countTv = filteredAavegotchis.length;
      // console.log(tv, filteredAavegotchis, countTv);
      data.push([tv, countTv]);
    }
    return data;
  }

  async retrieveListings(tokenIds) {
    console.log('retrieveListings', tokenIds);

    let tokenIdString = "";
    tokenIds.map(function(value, index) {
      tokenIdString += "\"" + value + "\","
    });

    const query = `{
      erc721Listings(first: 1000, where: { tokenId_in: [${tokenIdString}], cancelled: false, timePurchased: "0" }) {
        id
        tokenId
        priceInWei
      }
    }`;

    console.log('query', query);

    const listings = await axios.post(
      'https://api.thegraph.com/subgraphs/name/aavegotchi/aavegotchi-core-matic',
      {
        query: query
      }
    );

    this.setState({erc721Listings: listings.data.data.erc721Listings});
    console.log(listings.data.data.erc721Listings);
  }

  async retrieveGotchis(trait, traitValue) {
    console.log('trait', trait, 'value', traitValue);
    const gotchisByTraitValue = _.filter(this.state.aavegotchis, [`numericTraits[${trait}]`, traitValue]);
    console.log(gotchisByTraitValue);
    this.setState({ gotchisByTraitValue: gotchisByTraitValue, trait: trait, traitValue: traitValue });

    let tokenIds = [];
    gotchisByTraitValue.map(function(a, index) {
      tokenIds.push(a.id);
    });
    this.retrieveListings(tokenIds);
  }

  renderGotchis() {
    const _this = this;
    if (this.state.gotchisByTraitValue.length > 0) {
      const columns = [
        { field: 'id', headerName: 'ID', width: 80 },
        { field: 'name', headerName: 'Name', width: 220 },
        { field: 'brs', headerName: 'BRS', width: 80 },
        { field: 'mrs', headerName: 'MRS', width: 85 },
        {
          field: 'listing',
          headerName: 'Listing',
          width: 110,
          renderCell: (params: GridCellParams) => (
            params.value.link && params.value.text && (
              <a href={(params.value.link)} target="_blank">
                {(params.value.text)}
              </a>
            )
          )
        },
        { field: 'nrg', headerName: 'Energy', width: 100 },
        { field: 'agg', headerName: 'Aggression', width: 130 },
        { field: 'spk', headerName: 'Spookiness', width: 130 },
        { field: 'brn', headerName: 'Brain Size', width: 120 },
        { field: 'eyeShape', headerName: 'Eye Shape', width: 120 },
        { field: 'eyeColor', headerName: 'Eye Color', width: 120 },
      ];

      let rows = [];
      this.state.gotchisByTraitValue.map(function(a, index) {
        let row = {
          id: a.id,
          name: a.name,
          nrg: a.numericTraits[0],
          agg: a.numericTraits[1],
          spk: a.numericTraits[2],
          brn: a.numericTraits[3],
          eyeShape: a.numericTraits[4],
          eyeColor: a.numericTraits[5],
          brs: a.baseRarityScore,
          mrs: a.modifiedRarityScore,
        };

        const listing = _.filter(_this.state.erc721Listings, ['tokenId', a.id]);
        console.log('filtered', listing);
        if (listing.length > 0) {
          row.listing = {
            link: `https://aavegotchi.com/baazaar/erc721/${listing[0].id}`,
            text: `${Math.round(listing[0].priceInWei / 1000000000000000000)}`,
          };
        } else {
          row.listing = {
            link: 'https://aavegotchi.com/baazaar/aavegotchis',
            text: 'None',
          };
        }

        rows.push(row);
      });

      return (
        <div>
          <h2>Aavegotchis with {this.state.traits[this.state.trait]} of {this.state.traitValue}</h2>
          <p>Count: {rows.length}</p>
          <div style={{ height: '1080px', width: '100%' }}>
            <DataGrid rows={rows} columns={columns} pageSize={100} density="compact" />
          </div>
        </div>
      );
    }
  }

  renderTraitsDistribution() {
    const _this = this;

    if (Object.keys(this.state.aavegotchis).length > 0) {
      const options = {
        title: {
          text: 'Summoned Aavegotchis Base Traits Distribution',
        },
        subtitle: {
          text: `${this.state.summonedGotchis} Summoned Gotchis`
        },
        series: [
          { data: this.calculateData(0), name: 'Energy' },
          { data: this.calculateData(1), name: 'Aggression' },
          { data: this.calculateData(2), name: 'Spookiness' },
          { data: this.calculateData(3), name: 'Brain Size' },
          { data: this.calculateData(4), name: 'Eye Shape' },
          { data: this.calculateData(5), name: 'Eye Color' },
        ],
        plotOptions: {
          series: {
            allowPointSelect: true,
            point: {
              events: {
                click: function () {
                  _this.retrieveGotchis(this.series.index, this.x);
                }
              }
            }
          }
        },
        xAxis: {
          title: {
            text: 'Base Trait Value'
          }
        },
        yAxis: {
          title: {
            text: 'Gotchi Count'
          }
        },
        tooltip: {
          pointFormat: '{series.name} Trait of {point.x}: <b>{point.y}</b><br/>',
          valueSuffix: ' Gotchis',
          shared: false
        },
      }

      return (
        <HighchartsReact
          highcharts={Highcharts}
          options={options}
        />
      );
    }
  }

  render() {
    return (
      <div>
        <h1>Aavegotchi Traits Distribution</h1>
        {this.renderTraitsDistribution()}
        {this.renderGotchis()}
      </div>
    );
  }
}

export default AavegotchiTraitDistributions;
