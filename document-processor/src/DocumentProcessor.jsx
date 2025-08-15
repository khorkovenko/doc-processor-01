import React, { useState } from 'react';
import { Upload, FileText, Send, CheckCircle } from 'lucide-react';
import * as mammoth from 'mammoth';
import { Document, Packer, Paragraph } from "docx";
import emailjs from '@emailjs/browser';

const DocumentProcessor = () => {
    const [file, setFile] = useState(null);
    const [variables, setVariables] = useState([]);
    const [values, setValues] = useState({});
    const [email, setEmail] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [originalContent, setOriginalContent] = useState('');
    const [fileName, setFileName] = useState('');

    const extractVariables = (content) => {
        const regex = /\{\{([^}]+)\}\}/g;
        const matches = [];
        let match;
        while ((match = regex.exec(content)) !== null) {
            const varName = match[1].trim();
            if (!matches.includes(varName)) matches.push(varName);
        }
        return matches;
    };

    const handleFileUpload = async (event) => {
        const uploadedFile = event.target.files[0];
        if (!uploadedFile) return;

        setIsProcessing(true);
        setFile(uploadedFile);
        setFileName(uploadedFile.name);

        try {
            let content = '';

            if (uploadedFile.name.endsWith('.docx')) {
                const arrayBuffer = await uploadedFile.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer });
                content = result.value;
            } else if (uploadedFile.name.endsWith('.doc') || uploadedFile.name.endsWith('.txt')) {
                content = await uploadedFile.text();
            } else {
                alert('Please upload a .doc, .docx, or .txt file');
                setIsProcessing(false);
                return;
            }

            setOriginalContent(content);
            const extractedVars = extractVariables(content);
            setVariables(extractedVars);

            const initialValues = {};
            extractedVars.forEach(varName => initialValues[varName] = '');
            setValues(initialValues);
        } catch (error) {
            console.error('Error processing file:', error);
            alert('Error processing file. Please try again.');
        }

        setIsProcessing(false);
    };

    const handleValueChange = (varName, value) => {
        setValues(prev => ({ ...prev, [varName]: value }));
    };

    const processDocument = () => {
        let processedContent = originalContent;

        variables.forEach(varName => {
            const value = values[varName] || '';
            let replacement = value;

            if (value.length < varName.length) {
                const underscoresNeeded = varName.length - value.length;
                const underscoresEachSide = Math.floor(underscoresNeeded / 2);
                const extraUnderscore = underscoresNeeded % 2;
                replacement = '_'.repeat(underscoresEachSide + extraUnderscore) + value + '_'.repeat(underscoresEachSide);
            }

            const regex = new RegExp(`\\{\\{\\s*${varName}\\s*\\}\\}`, 'g');
            processedContent = processedContent.replace(regex, replacement);
        });

        return processedContent;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!email) {
            alert('Please enter an email address');
            return;
        }

        if (!file) {
            alert('Please upload a document first');
            return;
        }

        setIsSubmitting(true);

        try {
            const processedContent = processDocument();
            const originalExt = fileName.split('.').pop().toLowerCase();
            let blob;
            let downloadFileName;

            if (originalExt === "txt") {
                blob = new Blob([processedContent], { type: "text/plain" });
                downloadFileName = `processed_${fileName.replace(/\.[^/.]+$/, '')}.txt`;
            } else {
                const doc = new Document({
                    sections: [{
                        properties: {},
                        children: processedContent.split("\n").map(line => new Paragraph(line))
                    }]
                });
                blob = await Packer.toBlob(doc);
                downloadFileName = `processed_${fileName.replace(/\.[^/.]+$/, '')}.docx`;
            }

            // Convert file to base64 for EmailJS
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64data = reader.result.split(',')[1]; // Remove "data:application/...;base64,"

                const templateParams = {
                    to_email: email,
                    file_name: downloadFileName,
                    message: "Please find the processed document attached.",
                    attachment: base64data
                };

                await emailjs.send(
                    "service_2aw171i",
                    "template_825etyj",
                    templateParams,
                    "HHkePgkq8bBIAPUIx"
                );

                setSubmitted(true);
            };

            reader.readAsDataURL(blob);
        } catch (error) {
            console.error("Error sending document:", error);
            alert("Error preparing document. Please try again.");
        }

        setIsSubmitting(false);
    };

    const resetForm = () => {
        setFile(null);
        setVariables([]);
        setValues({});
        setEmail('');
        setSubmitted(false);
        setOriginalContent('');
        setFileName('');
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Document Sent!</h2>
                    <p className="text-gray-600 mb-6">
                        Your processed document has been sent to <strong>{email}</strong>.
                    </p>
                    <button
                        onClick={resetForm}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        Process Another Document
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
            <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-lg shadow-xl overflow-hidden">
                    <div className="bg-indigo-600 text-white p-6">
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <FileText className="w-6 h-6" />
                            Document Variable Processor
                        </h1>
                        <p className="text-indigo-100 mt-2">
                            Upload a document, fill in variables, and have it emailed to you automatically
                        </p>
                    </div>
                    <div className="p-6">
                        {!file ? (
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-400 transition-colors">
                                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-700 mb-2">Upload your document</h3>
                                <p className="text-gray-500 mb-4">Support for .doc, .docx, and .txt files with variable placeholders</p>
                                <label className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer inline-block">
                                    Choose File
                                    <input type="file" accept=".doc,.docx,.txt" onChange={handleFileUpload} className="hidden" disabled={isProcessing} />
                                </label>
                                {isProcessing && <p className="text-indigo-600 mt-2">Processing document...</p>}
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h3 className="font-medium text-gray-700 mb-2">Uploaded File:</h3>
                                    <p className="text-indigo-600">{fileName}</p>
                                    <button type="button" onClick={resetForm} className="text-red-600 hover:text-red-700 text-sm mt-2">
                                        Upload Different File
                                    </button>
                                </div>
                                {variables.length > 0 && (
                                    <div>
                                        <h3 className="text-lg font-medium text-gray-700 mb-4">Fill in Variables ({variables.length} found)</h3>
                                        <div className="grid gap-4 md:grid-cols-2">
                                            {variables.map((varName) => (
                                                <div key={varName}>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">`${varName}`</label>
                                                    <input type="text" value={values[varName] || ''} onChange={(e) => handleValueChange(varName, e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder={`Enter value for ${varName}`} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="Enter email to receive processed document" required />
                                </div>
                                <button type="button" onClick={handleSubmit} disabled={isSubmitting || variables.length === 0} className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
                                    {isSubmitting ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Sending via Email...</> : <><Send className="w-4 h-4" />Process & Send Document</>}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DocumentProcessor;
