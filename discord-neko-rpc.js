const DiscordRPC = require('discord-rpc');
DiscordRPC.register(discordPresenceId);
//const discordPresenceId = '<Your discord id goes here>';

export default class DiscordPresence {

    constructor(settings) {
        this.rpc = null;
        this.updater = null;
        this.IpcBytes = 0; 

        this._settings = settings; // Engine.Settings
        this.enabled = false;
        this.enabledHentai = false;
        this.hentai = false; // Is current content contains nsfw

        // Dicord Current status
        this.status = {
            largeImageKey: 'logo',
            largeImageText: 'reading a manga or comic',
            SmallImageKey: "",
            SmallImageText: "",
        };
        this.statusNew = true;

        //Eventhandlers
        this._settings.addEventListener('loaded', this._onSettingsChanged.bind(this));
        this._settings.addEventListener('saved', this._onSettingsChanged.bind(this));
        
        document.addEventListener( EventListener.onSelectConnector, this._onSelectConnector.bind(this) );
        document.addEventListener( EventListener.onSelectManga, this._onSelectManga.bind(this) );
        document.addEventListener( EventListener.onSelectChapter, this._onSelectChapter.bind(this) );
    }

    _onSettingsChanged() {
        this.enabled = this._settings.discordPresence.value !== 'none';
        this.enabledHentai = this._settings.discordPresence.value === 'hentai';

        if (this.enabled) {
            this.statusNew = true;
            this.startDiscordPresence();
        } else {
            this.stopDiscordPresence();
        }
    }

    _onSelectConnector(event) {
        this.isThisHentai(event.detail.tags);
        this.status['details'] = 'Browsing' + event.detail.label;
        if (this.status.state) delete this.status.state;
        this.status.startTimestamp = + new Date();
        this.statusNew = true;
        if (this.enabled && !this.rpc) this.startDiscordPresence();
    }

    _onSelectManga(event) {
        this.isThisHentai(event.detail.connector.tags);
        this.status['details'] = 'Browsin... ' + event.detail.connector.label;
        this.status['state'] = 'Catalog ' + event.detail.title;
        this.status.startTimestamp = + new Date();
        this.statusNew = true;
        if (this.enabled && !this.rpc) this.startDiscordPresence();
    }

    _onSelectChapter(event) {
        this.isThisHentai(event.detail.manga.connector.tags);
        this.status['details'] = 'Viewing' + event.detail.manga.title;
        this.status['state'] = event.detail.title.padEnd(2); // State min. length is 2 char
        this.status.startTimestamp = + new Date();
        this.statusNew = true;
        if (this.enabled && !this.rpc) this.startDiscordPresence();
    }

    isThisHentai(tags) {
        // Hentai check
        tags = tags.map(t => t.toLowerCase());
        if(tags.includes('NSFW') || tags.includes('NSFW-content')) {
            this.hentai = true;
        } else {
            this.hentai = false;
        }
    }

    async updateStatus() {
        if(this.rpc) {
            if (this.enabled && this.statusNew) {
                this.IpcBytes = this.rpc.transport.socket.bytesWritten;
                if( !this.hentai || this.hentai && this.enabledHentai) {
                    this.rpc.setActivity(this.status);
                } else {
                    this.statusNew = false;
                }
            }


            if ( this.statusNew && this.rpc.transport.socket.bytesWritten > this.IpcBytes) {
                this.IpcBytes = this.rpc.transport.socket.bytesWritten;
                this.statusNew = false;
            } else if (this.rpc.transport.socket.bytesWritten == this.IpcBytes && this.statusNew) {
                console.warn('WARNING: DiscordPresence - Lost connection to Discord.');
                this.stopDiscordPresence();
            }
        }
    }

    stopDiscordPresence() {
        this.statusNew = false;
        clearInterval(this.updater);
        if (this.rpc) {
            this.rpc.clearActivity();
            this.rpc.destroy();
        }
        this.rpc = null;
    }

    async startDiscordPresence() {
        if(this.rpc) {
            return; 
        }
        this.rpc = new DiscordRPC.Client({ transport: 'ipc' });
        this.rpc.on('ready', () => {
            this.status.startTimestamp = + new Date();


            setTimeout( () => {
                this.updateStatus();
            }, 2000);


            this.updater = setInterval(() => {
                this.updateStatus();
            }, 12000);
        });

        try {
            await this.rpc.login({ clientId: discordPresenceId });
        } catch (error) {
            if (typeof error !== 'undefined') { 
                if (/Could not connect/i.test(error.message)) {
                    console.warn('Could not connect (Is Discord running?)');
                    return;
                }

                if (/RPC_CONNECTION_TIMEOUT/i.test(error.message)) {
                    console.warn(RPC connection timed out.');
                    // Reset
                    this.rpc = null;

                    setTimeout( () => {
                        this._onSettingsChanged();
                    }, 100000);

                    return;
                }

                throw error; // Unknown error

            } else { 
                console.warn('DiscordPresence - Connection was closed unexpectedly.');
                // Reset
                this.rpc = null;

                setTimeout( () => {
                    this._onSettingsChanged();
                }, 15200);
            }
        }
    }
