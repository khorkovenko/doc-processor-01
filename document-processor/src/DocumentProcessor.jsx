import React, { useState } from 'react';
import { Upload, FileText, Send, CheckCircle } from 'lucide-react';
import * as mammoth from 'mammoth';
import { Document, Packer, Paragraph } from 'docx';

const DocumentProcessor = () => {
    const [file, setFile] = useState(null);
    const [variables, setVariables] = useState([]);
    const [values, setValues] = useState({});
    const [email, setEmail] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [content, setContent] = useState('');
    const [fileName, setFileName] = useState('');

    const extractVariables = (text) => [...new Set([...text.matchAll(/\{\{([^}]+)\}\}/g)].map(m => m[1].trim()))];

    const handleFileUpload = async (e) => {
        const uploadedFile = e.target.files[0];
        if (!uploadedFile) return;

        setIsProcessing(true);
        setFile(uploadedFile);
        setFileName(uploadedFile.name);

        try {
            let text = '';
            if (uploadedFile.name.endsWith('.docx')) {
                const arrayBuffer = await uploadedFile.arrayBuffer();
                text = (await mammoth.extractRawText({ arrayBuffer })).value;
            } else if (uploadedFile.name.match(/\.doc$|\.txt$/)) {
                text = await uploadedFile.text();
            } else {
                alert('Please upload a .doc, .docx, or .txt file');
                setIsProcessing(false);
                return;
            }

            setContent(text);
            const vars = extractVariables(text);
            setVariables(vars);
            setValues(Object.fromEntries(vars.map(v => [v, ''])));
        } catch (err) {
            console.error(err);
            alert('Error processing file. Please try again.');
        }
        setIsProcessing(false);
    };

    const handleValueChange = (varName, value) => setValues(prev => ({ ...prev, [varName]: value }));

    const processContent = () => {
        let processed = content;
        variables.forEach(v => {
            const val = values[v] || '';
            const unders = val.length < v.length ? '_'.repeat(Math.floor((v.length - val.length)/2)) : '';
            processed = processed.replace(new RegExp(`\\{\\{\\s*${v}\\s*\\}\\}`, 'g'), `${unders}${val}${unders}`);
        });
        return processed;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email || !file) return alert('Please provide an email and upload a document');

        setIsSubmitting(true);
        try {
            const processed = processContent();
            const ext = fileName.split('.').pop().toLowerCase();
            let blob, downloadName;

            if (ext === 'txt') {
                blob = new Blob([processed], { type: 'text/plain' });
                downloadName = `processed_${fileName.replace(/\.[^/.]+$/, '')}.txt`;
            } else {
                const doc = new Document({ sections: [{ children: processed.split('\n').map(line => new Paragraph(line)) }] });
                blob = await Packer.toBlob(doc);
                downloadName = `processed_${fileName.replace(/\.[^/.]+$/, '')}.docx`;
            }

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = downloadName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent('Processed Document')}&body=${encodeURIComponent(`Hello,\n\nPlease find the processed document attached.\n\n(Downloaded as: ${downloadName})`)}`, '_blank');

            setSubmitted(true);
        } catch (err) {
            console.error(err);
            alert('Error preparing document. Please try again.');
        }
        setIsSubmitting(false);
    };

    const resetForm = () => {
        setFile(null);
        setVariables([]);
        setValues({});
        setEmail('');
        setSubmitted(false);
        setContent('');
        setFileName('');
    };

    if (submitted)
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
                <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full text-center">
                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold mb-2">Document Sent!</h2>
                    <p className="text-gray-600 mb-6">
                        Your processed document has been sent to <strong>{email}</strong> and downloaded.
                    </p>
                    <button onClick={resetForm} className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700">
                        Process Another Document
                    </button>
                </div>
            </div>
        );

    return (
        <div className="min-h-screen p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="bg-white rounded-lg shadow-xl overflow-hidden">
                    <div className="bg-indigo-600 text-white p-6">
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <FileText className="w-6 h-6" /> Document Variable Processor
                        </h1>
                        <p className="text-indigo-100 mt-2">Upload a document, fill variables, and send via email</p>
                    </div>

                    <div className="p-6">
                        {!file ? (
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-indigo-400 transition-colors">
                                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-500 mb-4">Support .doc, .docx, .txt files with `{{variable}}`</p>
                                <label className="bg-indigo-600 text-white px-6 py-2 rounded-lg cursor-pointer inline-block hover:bg-indigo-700">
                                    Choose File
                                    <input type="file" accept=".doc,.docx,.txt" onChange={handleFileUpload} className="hidden" disabled={isProcessing} />
                                </label>
                                {isProcessing && <p className="text-indigo-600 mt-2">Processing...</p>}
                            </div>
                        ) : (
                            <form className="space-y-6" onSubmit={handleSubmit}>
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <p className="text-indigo-600 font-medium">{fileName}</p>
                                    <button type="button" onClick={resetForm} className="text-red-600 mt-2 text-sm hover:text-red-700">
                                        Upload Different File
                                    </button>
                                </div>

                                {variables.length > 0 && (
                                    <div>
                                        <h3 className="text-lg font-medium mb-4">Fill Variables ({variables.length})</h3>
                                        <div className="grid gap-4 md:grid-cols-2">
                                            {variables.map(v => (
                                                <div key={v}>
                                                    <label className="block text-sm font-medium mb-1">{{v}}</label>
                                                    <input type="text" value={values[v]} onChange={(e) => handleValueChange(v, e.target.value)} placeholder={`Enter ${v}`} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium mb-1">Email Address *</label>
                                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter email" required className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                </div>

                                <button type="submit" disabled={isSubmitting || variables.length === 0} className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed">
                                    {isSubmitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Send className="w-4 h-4" />}
                                    {isSubmitting ? 'Processing & Sending...' : 'Process & Send Document'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-lg p-6">
                    <h3 className="text-lg font-medium mb-3">How it works:</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-600 text-sm">
                        <li>Upload a document containing `{{variable_name}}` placeholders.</li>
                        <li>Fill in the fields for each variable found.</li>
                        <li>If input is shorter than variable name, underscores are added on both sides.</li>
                        <li>Provide an email to receive the processed document.</li>
                        <li>Click submit to process and open Gmail with pre-filled email content.</li>
                    </ol>
                </div>
            </div>
        </div>
    );
};

export default DocumentProcessor;
