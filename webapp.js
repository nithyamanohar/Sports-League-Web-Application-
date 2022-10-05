'use strict';
const express = require('express');
const fs = require('fs');
let dir = './data'
let path = `${dir}/player.json`
let max_pid = 0; 
const app = express();

const handed_enum = {
    'left' : 'L', 
    'right' : 'R', 
    'ambi' : 'A'
}

const handed_enum_r = {
    'L' : 'left', 
    'R' : 'right', 
    'A' : 'ambi'
}

class PlayerSourceJson {
    constructor(file){
        this.file = file; 
        let timestamp = new Date()
        this.data = {
            players: [], 
            updated_at: timestamp, 
            created_at: timestamp, 
            version: "1.0"
        }
        if(!(fs.existsSync(dir))){
            fs.mkdirSync(dir);
            fs.writeFileSync(path, JSON.stringify(this.data, null, 4));
        }
        else{
            if(!(fs.existsSync(path))){
                fs.writeFileSync(path, JSON.stringify(this.data, null, 4));
            }
            else{
                this.data = JSON.parse(fs.readFileSync(this.file)); 
            }
    }
}
    getPlayer(pid) {
        let index = this.data.players.findIndex((obj=>obj.pid ==pid));
        return index >= 0 ? this.data.players[index] : null;

    }

    createPlayer(fname, lname, handed, is_active, initial_balance){
        let new_pid = max_pid+1; 
        max_pid += 1; 
        this.data.players.push({
            "pid": new_pid,  
            "fname": fname,
            "lname": lname, 
            "handed": handed, 
            "is_active": true,
            "balance_usd": Number(initial_balance).toFixed(2)
        })
        this._updateDb();
        return new_pid;
    }

    updatePlayer(pid, lname, is_active, deposit_value) {
        let index = this.data.players.findIndex((obj=>obj.pid ==pid));
        if(index>=0){
            let player = this.data.players[index]; 
            this.data.players[index]={
                "pid": player.pid, 
                "fname": player.fname, 
                "lname": lname == null ? player.lname : lname, 
                "handed": player.handed, 
                "is_active": is_active == null ? player.is_active : is_active, 
                "balance_usd": (Number(player.balance_usd)+ (deposit_value > 0 ? deposit_value : 0)).toFixed(2)
            }
        }
        else{
            return null;
        }
        this._updateDb();
        return pid;
    }

    deletePlayer(pid) {
        let index = this.data.players.findIndex((obj=>obj.pid ==pid));
        if(index>=0){
            this.data.players.splice(index,1);
        }
        else{
            return null;
        }
        this._updateDb();
        return pid; 
    }

    getBalance(pid) {
        let index = this.data.players.findIndex((obj=>obj.pid ==pid));
        return index >= 0 ? this.data.players[index].balance_usd : null;
    }

    getPlayers() {
        let result = this._formatPlayer(this.data.players);
        return result.sort((a,b) => {
            if(a.name < b.name){
                return -1
            }
            if(a.name>b.name){
                return 1
            }
            return 0
        })
    }

    _formatPlayer(player){
        if(player== null){
            return null;
        }
        if(Array.isArray(player)){
            return player.map(this._formatPlayer)
        }
        let return_dict = {
            pid: player.pid, 
            name: `${player.fname}${player.lname ? ` ${player.lname}`:''}`,
            handed: handed_enum_r[player.handed], 
            is_active:player.is_active, 
            balance_usd: player.balance_usd 
        }
        return return_dict;
    }

    _updateDb(){
        let timestamp = new Date();
        this.data.updated_at = timestamp; 
        fs.writeFileSync(this.file, JSON.stringify(this.data, null, 4))
    }

}

// app.use('/player/:pid', (req, res, next) => {
//     if (req.method.toLowerCase() == "post") {
//         console.error(req.originalUrl);
//     }
//     next()
// })

app.get('/ping', function (req, res) {
    res.sendStatus(204);
});

app.get('/player', function (req, res) {
    let player_data = new PlayerSourceJson(path);
    var result = player_data.getPlayers();
    res.status(200).send(JSON.stringify(result));
});

app.get('/player/:pid', function (req, res) {
    let player_data = new PlayerSourceJson(path);
    var player = player_data._formatPlayer(player_data.getPlayer(req.params.pid));
    if(player == null){
        res.sendStatus(404);
        return
    }
    res.status(200).send(JSON.stringify(player));
});

app.delete('/player/:pid', function (req, res) {
    let player_data = new PlayerSourceJson(path);
    let delete_status = player_data.deletePlayer(req.params.pid);
    if(delete_status){
        res.redirect(303,'/player');
        return;
    }
    res.sendStatus(404);
});

app.post('/player', function (req, res) {
    let player_data = new PlayerSourceJson(path);
    let lname = req.query?.lname; 
    let fname = req.query?.fname; 
    let handed = req.query?.handed; 
    let initial_balance_usd = req.query?.initial_balance_usd; 

    let error = false; 
    let result = 'invalid fields:'; 

    if(!(/^[a-zA-Z]+$/.test(fname))){
        error = true; 
        result+='fname';
    }

    if(lname != undefined && !(/(^[a-zA-Z]+$)*/.test(lname))){
        console.error(`lname: ${lname}`)
        error = true; 
        result+='lname';
    }

    if(!(['left', 'right', 'ambi'].includes(handed.toLowerCase()))){
        result += 'handed'; 
        error = true;
    }

    if(isNaN(Number(initial_balance_usd)) || 
    Number(initial_balance_usd) < 0 ||  
    Number(initial_balance_usd) !=  Number(Number(initial_balance_usd).toFixed(2))) {
        result += 'initial_balance_usd'; 
        error = true; 
    }

    if(!error){
        let pid = player_data.createPlayer(fname, lname, handed_enum[handed.toLowerCase()], null, Number(initial_balance_usd));
        res.redirect(303, `/player/${pid}`);
    }
    else{
        res.status(422).send(result);
    }
    
});

app.post('/player/:pid', function (req, res) {
    let player_data = new PlayerSourceJson(path);
    let is_active = req.query?.active;
    let lname = req.query?.lname; 
    let error = false; 
    if(is_active != undefined && ['1','true','t'].includes(is_active.toLowerCase())){
        is_active = true; 
    }
    else{
        is_active = false; 
    }
    if(lname != undefined && !(/(^[a-zA-Z]+$)*/.test(lname))){
        error = true; 
    }
    if(!error){
        let pid = player_data.updatePlayer(req.params.pid, lname, is_active, null);
        if(pid){
            res.redirect(303, `/player/${pid}`); 
        }
        else{
            res.sendStatus(404);
        }
    }
    else{
        res.sendStatus(422);
    }
});

app.post('/deposit/player/:pid', function (req, res) {
    let player_data = new PlayerSourceJson(path);
    let deposit_value = req.query?.amount_usd; 
    let pid = req.params.pid; 

    if(isNaN(Number(deposit_value)) || 
    Number(deposit_value) < 0 ||  
    Number(deposit_value) !=  Number(Number(deposit_value).toFixed(2))) {
    res.sendStatus(400);
    return;
    }
    let player = player_data.getPlayer(pid); 
    if(player){
        let update_status = player_data.updatePlayer(pid, null, null, Number(deposit_value)); 
        if(update_status){
            res.status(200).send(JSON.stringify({
                old_balance_usd: player.balance_usd, 
                new_balance_usd: player_data.getPlayer(pid).balance_usd
            }))
        }
        }
        else{
            res.sendStatus(404);
        }
});

app.listen(3000, ()=>{});
