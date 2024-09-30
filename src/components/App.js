import React, { Component } from 'react';
import Web3 from 'web3';
import Identicon from 'identicon.js';
import './App.css';
import SocialNetwork from '../abis/SocialNetwork.json'
import Navbar from './NavBar.js'
import Main from './Main'
import { create } from 'ipfs-http-client';
import axios from 'axios';

const pinataApiKey = '6c57ab8e116eba326e6c';
const pinataSecretApiKey = '5fb4e49e3db16b2a41f090cef5767ad1dfca8d40b26aef9fa7835ce056909072';

class App extends Component {

  async componentWillMount() {
    await this.loadWeb3()
    await this.loadBlockchainData()
  }

  async loadWeb3() {
    if (window.ethereum) {
      window.web3 = new Web3(window.ethereum)
      await window.ethereum.enable()
    }
    else if (window.web3) {
      window.web3 = new Web3(window.web3.currentProvider)
    }
    else {
      window.alert('Non-Ethereum browser detected. You should consider trying MetaMask!')
    }
  }

  async loadBlockchainData() {
    const web3 = window.web3
    // Load account
    const accounts = await web3.eth.getAccounts()
    this.setState({ account: accounts[0] })
    // Network ID
    const networkId = await web3.eth.net.getId()
    const networkData = SocialNetwork.networks[networkId]
    if(networkData) {
      const socialNetwork = web3.eth.Contract(SocialNetwork.abi, networkData.address)
      this.setState({ socialNetwork })
      const postCount = await socialNetwork.methods.postCount().call()
      this.setState({ postCount })
      // Load Posts
      for (var i = 1; i <= postCount; i++) {
        const post = await socialNetwork.methods.posts(i).call()
        this.setState({
          posts: [...this.state.posts, post]
        })
      }
      // Sort posts. Show highest tipped posts first
      this.setState({
        posts: this.state.posts.sort((a,b) => b.tipAmount - a.tipAmount )
      })
      this.setState({ loading: false})
    } else {
      window.alert('SocialNetwork contract not deployed to detected network.')
    }
  }

  constructor(props) {
    super(props);
    this.state = {
      account: '',
      socialNetwork: null,
      postCount: 0,
      posts: [],
      buffer: null,
      content: ''
    };

    this.captureFile = this.captureFile.bind(this);
    this.uploadImage = this.uploadImage.bind(this);
    this.createPost = this.createPost.bind(this);
    this.tipPost = this.tipPost.bind(this);
  }

  captureFile(event) {
    event.preventDefault();
    const file = event.target.files[0];
    const reader = new window.FileReader();
    reader.readAsArrayBuffer(file);
    reader.onloadend = () => {
      this.setState({ buffer: Buffer(reader.result) });
    };
  }

  // createPost(content) {
  //   this.setState({ loading: true })
  //   this.state.socialNetwork.methods.createPost(content).send({ from: this.state.account })
  //   .once('receipt', (receipt) => {
  //     this.setState({ loading: false })
  //   })
  // }

  async tipPost(id, tipAmount) {
    this.setState({ loading: true })
    this.state.socialNetwork.methods.tipPost(id).send({ from: this.state.account, value: tipAmount })
    .once('receipt', (receipt) => {
      this.setState({ loading: false })
    })
  }

  // constructor(props) {
  //   super(props)
  //   this.state = {
  //     account: '',
  //     socialNetwork: null,
  //     postCount: 0,
  //     posts: [],
  //     loading: true
  //   }

  //   this.createPost = this.createPost.bind(this)
  //   this.tipPost = this.tipPost.bind(this)
  // }

  async uploadImage() {
    const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;
    let data = new FormData();
    data.append('file', new Blob([this.state.buffer]), 'image.png');

    const response = await axios.post(url, data, {
      maxContentLength: 'Infinity',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${data._boundary}`,
        'pinata_api_key': pinataApiKey,
        'pinata_secret_api_key': pinataSecretApiKey
      }
    });

    return response.data.IpfsHash;
  }

  async createPost(content) {
    let imageHash = '';
    if (this.state.buffer) {
      imageHash = await this.uploadImage();
    }
    this.state.socialNetwork.methods.createPost(content, imageHash).send({ from: this.state.account })
      .once('receipt', (receipt) => {
        this.setState({ content: '', buffer: null });
      });
  }

  render() {
    return (
      <div>
        <Navbar account={this.state.account} />
        { this.state.loading
          ? <div id="loader" className="text-center mt-5"><p>Loading...</p></div>
          : <Main
              posts={this.state.posts}
              createPost={this.createPost}
              tipPost={this.tipPost}
              captureFile={this.captureFile}
            />
        }
      </div>
    );
  }
}

export default App;