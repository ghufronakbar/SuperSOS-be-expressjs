'use strict';

var response = require('../../res');
var connection = require('../../connection');
var md5 = require('md5');
var ip = require('ip');
var config = require('../../config/secret')
var jwt = require('jsonwebtoken');
var mysql = require('mysql');

//PROFILE
exports.profile = function (req, res) {
    let id_instances = req.params.id_instances
    connection.query(`
        SELECT 
            i.id_instances, 
            i.instances_name, 
            i.address, 
            i.email, 
            i.phone,
            i.status, 
            i.type,
            (SELECT COUNT(*) FROM calls WHERE id_instances = i.id_instances) AS call_handled
        FROM instances AS i 
        WHERE id_instances=?
    `, [id_instances],
        function (error, rows, fields) {
            if (error) {
                console.log(error)
            } else {
                response.ok(rows, res);
            };
        }
    );
};


//PROFILE EDIT
exports.profileedit = function (req, res) {
    let instances_name = req.body.instances_name
    let address = req.body.address
    let email = req.body.email
    let phone = req.body.phone
    let id_instances = req.params.id_instances

    if (!(instances_name, address, email, phone)) {
        return res.status(400).json({ status: 400, message: "Field tidak boleh kosong" });
    } else {
        connection.query(`SELECT * FROM instances WHERE id_instances=?`, id_instances,
            (error, rows, fields) => {
                if (error) {
                    console.log(error);
                    return res.status(500).json({ status: 500, message: "Internal Server Error" });
                } else {
                    const currentEmail = rows[0].email;
                    connection.query(`SELECT email FROM instances WHERE email=? AND NOT id_instances=?`, [email, id_instances],
                        (error, r, result) => {
                            if (error) {
                                console.log(error)
                                return res.status(500).json({ status: 500, message: "Internal Server Error" });
                            } else {
                                if (r.length > 0) {
                                    return res.status(400).json({ status: 400, message: "Email sudah terdaftar" });
                                } else {
                                    connection.query(`UPDATE instances SET instances_name=?, address=?, phone=?, email=? WHERE id_instances=?`,
                                        [instances_name, address, phone, email === currentEmail ? currentEmail : email, id_instances],
                                        function (error, rows, fields) {
                                            if (error) {
                                                console.log(error)
                                                return res.status(500).json({ status: 500, message: "Internal Server Error" });
                                            } else {
                                                return res.status(200).json({ status: 200, message: "Edit profile berhasil" });
                                            }
                                        }
                                    );

                                }
                            }
                        }
                    )
                }
            }
        );
    }
};


//PROFILE PASSWORD
exports.profilepass = function (req, res) {
    let old_password = md5(req.body.old_password);
    let new_password = md5(req.body.new_password);
    let id_instances = req.params.id_instances;

    console.log(old_password)
    console.log(new_password)
    console.log(id_instances)
    // Periksa old_password dengan melakukan SELECT query
    connection.query(`
        SELECT password FROM instances WHERE id_instances = ?`,
        [id_instances],
        function (error, rows, fields) {
            if (error) {
                console.log(error);
                response.error("Error occurred while fetching old password", res);
            } else {
                // Periksa apakah password lama cocok
                if (rows.length > 0) {
                    if (rows[0].password === old_password) {
                        // Jika password lama cocok, lakukan update password
                        connection.query(`
                            UPDATE instances SET password=? WHERE id_instances=?`,
                            [new_password, id_instances],
                            function (error, rows, fields) {
                                if (error) {
                                    console.log(error);
                                    response.error("Error occurred while updating password", res);
                                } else {
                                    response.ok("Password updated successfully", res);
                                }
                            }
                        );
                    } else {
                        response.error("Old password does not match", res);
                    }
                } else {
                    response.error("Instance not found", res);
                }
            }
        }
    );
};

// REGISTER
exports.register = function (req, res) {
    let instances_name = req.body.instances_name;
    let address = req.body.address;
    let email = req.body.email;
    let phone = req.body.phone;
    let password = md5(req.body.password);
    let confirmation_password = md5(req.body.confirmation_password);
    let type = req.body.type;

    if (password == confirmation_password) {
        // Periksa apakah email sudah ada dalam database
        connection.query(`
            SELECT * FROM instances WHERE email = ?`,
            [email],
            function (error, emailRows, fields) {
                if (error) {
                    console.log(error);
                    response.error("Error occurred while checking existing email", res);
                } else {
                    // Jika email sudah ada, kirimkan pesan kesalahan
                    if (emailRows.length > 0) {
                        return res.status(400).json({ status: 400, message: "Email sudah terdaftar!" })
                    } else {
                        // Periksa apakah phone sudah ada dalam database
                        connection.query(`
                            SELECT * FROM instances WHERE phone = ?`,
                            [phone],
                            function (error, phoneRows, fields) {
                                if (error) {
                                    console.log(error);
                                    response.error("Error occurred while checking existing phone", res);
                                } else {
                                    // Jika phone sudah ada, kirimkan pesan kesalahan
                                    if (phoneRows.length > 0) {
                                        return res.status(400).json({ status: 400, message: "Nomor telepon sudah terdaftar!" })
                                    } else {
                                        // Jika email dan phone belum ada, lakukan INSERT
                                        connection.query(`
                                            INSERT INTO instances(instances_name, address, email, phone, password, status, type) VALUES(?,?,?,?,?,?,?)`,
                                            [instances_name, address, email, phone, password, 0, type],
                                            function (error, rows, fields) {
                                                if (error) {
                                                    console.log(error);
                                                    response.error("Error occurred while registering", res);
                                                } else {
                                                    return res.status(200).json({ status: 200, message: "Registrasi berhasil!" })
                                                }
                                            }
                                        );
                                    }
                                }
                            }
                        );
                    }
                }
            }
        );
    } else {
        return res.status(400).json({ status: 400, message: "Password tidak cocok!" })
    }
};




//LOGIN
exports.login = function (req, res) {
    var post = {
        email: req.body.email,
        password: req.body.password
    }

    var query = "SELECT id_instances, instances_name, address, email, phone, status, type FROM ?? WHERE ??=? AND ??=?";
    var table = ["instances", "password", md5(post.password), "email", post.email];

    query = mysql.format(query, table);
    connection.query(query, function (error, rows) {
        if (error) {
            console.log(error)
        } else {

            if (rows.length == 0) {

                res.json({
                    "Error": true,
                    "Message": "Emaill or Password doesn't match!"
                })

            } else if (rows.length == 1) {

                let status = rows[0].status
                if (status == 0) {

                    res.json({
                        "Error": true,
                        "Message": "Instances Has Not Approved!"
                    })
                } else {

                    var token = jwt.sign({ rows }, config.secret, {
                        expiresIn: 1440 * 10000
                    });
                    let id_instances = rows[0].id_instances;

                    var data = {
                        id_instances: id_instances,
                        token: token,
                        ip_address: ip.address()
                    }

                    var query = "INSERT INTO ?? SET ?";
                    var table = ["akses_token"];

                    query = mysql.format(query, table);
                    connection.query(query, data, function (error, rows) {
                        if (error) {
                            console.log(error)
                        } else {
                            res.json({
                                success: true,
                                message: "Token JWT Generated!",
                                token: token,
                                currUser: data.id_instances
                            });
                        }
                    });
                }


            }

        }
    })
}


